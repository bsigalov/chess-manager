#!/usr/bin/env tsx
/**
 * scrape-rankings-full.ts
 * Scrapes ALL players from chess.org.il PlayersRanking.aspx and enriches
 * each with full profile data (birth year, FIDE ratings, titles, club, etc.)
 *
 * Flow:
 *   Phase 1: Scrape all ranking pages (sequential, ~25 pages × 100 = ~2500 players)
 *   Phase 2: Fetch each player's profile page concurrently (configurable workers)
 *   Phase 3: Upsert into DB with full data
 *
 * Usage:
 *   npx tsx scripts/scrape-rankings-full.ts                   # full run (5 workers)
 *   npx tsx scripts/scrape-rankings-full.ts --workers 10      # more concurrency
 *   npx tsx scripts/scrape-rankings-full.ts --delay-ms 1500   # slower (be polite)
 *   npx tsx scripts/scrape-rankings-full.ts --dry-run         # no DB writes
 *   npx tsx scripts/scrape-rankings-full.ts --player-only 4   # single player
 *   npx tsx scripts/scrape-rankings-full.ts --resume          # skip already fetched
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import {
  CookieSession,
  PlayerProfile,
  RankingEntry,
  scrapeAllRankingPages,
  scrapePlayerProfile,
} from "../lib/scrapers/chess-org-il";
import { delay } from "../lib/scrapers/chess-results-parser";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

import { prisma } from "../lib/db";

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isResume = args.includes("--resume");
const playerOnlyIdx = args.indexOf("--player-only");
const playerOnly = playerOnlyIdx !== -1 ? parseInt(args[playerOnlyIdx + 1], 10) : undefined;
const delayIdx = args.indexOf("--delay-ms");
const delayMs = delayIdx !== -1 ? parseInt(args[delayIdx + 1], 10) : 1500;
const workersIdx = args.indexOf("--workers");
const numWorkers = workersIdx !== -1 ? parseInt(args[workersIdx + 1], 10) : 5;
const pagesIdx = args.indexOf("--pages");
const maxPages = pagesIdx !== -1 ? parseInt(args[pagesIdx + 1], 10) : 50;

// ─── Checkpoint ───────────────────────────────────────────────────────────────

const CHECKPOINT_PATH = path.join(process.cwd(), "scripts", ".rankings-progress.json");

interface Checkpoint {
  rankings: RankingEntry[];
  rankingsFetched: boolean;
  processed: number[]; // israeliIds already done
}

function loadCheckpoint(): Checkpoint {
  if (isResume && fs.existsSync(CHECKPOINT_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf-8"));
    } catch { /* corrupted */ }
  }
  return { rankings: [], rankingsFetched: false, processed: [] };
}

function saveCheckpoint(cp: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

// ─── DB upsert ───────────────────────────────────────────────────────────────

async function upsertFromProfile(
  profile: PlayerProfile,
  rankingEntry?: RankingEntry
): Promise<string> {
  const israeliRank = profile.israeliRank ?? rankingEntry?.rank;

  // rating = FIDE standard if available, else Israeli rating
  const primaryRating = profile.fideRatingStandard ?? (profile.israeliRating || undefined);

  const metadataPayload = JSON.parse(JSON.stringify({
    israeliId: profile.israeliId,
    israeliRating: profile.israeliRating || undefined,
    israeliRank,
    expectedRating: profile.expectedRating,
    fideRatingStandard: profile.fideRatingStandard,
    cardValidUntil: profile.cardValidUntil?.toISOString(),
    cardActive: profile.cardActive,
    club: profile.club,
    israeliTitle: profile.israeliTitle,
    source: "chess-org-il",
  }));

  const playerData = {
    rating: primaryRating ?? null,
    rapidRating: profile.fideRatingRapid ?? null,
    blitzRating: profile.fideRatingBlitz ?? null,
    birthYear: profile.birthYear ?? null,
    title: profile.title ?? null,
    country: "ISR",
    isActive: true,
    metadata: metadataPayload,
  };

  // 1. Try match by fideId
  if (profile.fideId) {
    const existing = await prisma.player.findUnique({ where: { fideId: profile.fideId } });
    if (existing) {
      await maybeAddAlias(existing.id, profile.name, existing.name);
      await prisma.player.update({ where: { id: existing.id }, data: playerData });
      return existing.id;
    }
  }

  // 2. Try match by israeliId in metadata
  const byIsraeliId = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM players WHERE metadata->>'israeliId' = ${String(profile.israeliId)} LIMIT 1
  `;
  if (byIsraeliId.length > 0) {
    const { id, name } = byIsraeliId[0];
    await maybeAddAlias(id, profile.name, name);
    await prisma.player.update({ where: { id }, data: { ...playerData, fideId: profile.fideId ?? undefined } });
    return id;
  }

  // 3. Create new player
  const created = await prisma.player.create({
    data: {
      name: profile.name,
      fideId: profile.fideId ?? null,
      ...playerData,
    },
  });
  return created.id;
}

async function maybeAddAlias(playerId: string, newName: string, existingName: string) {
  if (newName && newName !== existingName) {
    await prisma.playerAlias.upsert({
      where: { playerId_alias: { playerId, alias: newName } },
      update: { source: "chess-org-il" },
      create: { playerId, alias: newName, source: "chess-org-il" },
    });
  }
}

// ─── Process single player ────────────────────────────────────────────────────

interface ProcessResult {
  saved: boolean;
  reason?: string;
  profile?: PlayerProfile;
}

async function processOne(
  israeliId: number,
  rankingEntry?: RankingEntry,
  dryRun = false
): Promise<ProcessResult> {
  const session = new CookieSession();
  try {
    const profile = await scrapePlayerProfile(session, israeliId);
    if (dryRun) return { saved: true, profile };
    await upsertFromProfile(profile, rankingEntry);
    return { saved: true, profile };
  } catch (err) {
    return { saved: false, reason: String(err) };
  }
}

// ─── Concurrent worker pool ───────────────────────────────────────────────────

async function runWorkerPool(
  rankings: RankingEntry[],
  processedSet: Set<number>,
  checkpoint: Checkpoint
): Promise<{ saved: number; failed: number }> {
  const queue = rankings.filter(r => !processedSet.has(r.israeliId));
  const total = queue.length;
  let queueIdx = 0;
  let completed = 0;
  let saved = 0;
  let failed = 0;
  let dirty = 0;
  const startTime = Date.now();

  async function worker(workerId: number) {
    await delay(workerId * 400); // stagger start
    while (true) {
      const idx = queueIdx++;
      if (idx >= queue.length) break;

      const entry = queue[idx];
      await delay(delayMs);
      const result = await processOne(entry.israeliId, entry, isDryRun);
      completed++;

      const elapsed = (Date.now() - startTime) / 1000;
      const rate = completed / elapsed;
      const eta = Math.round((total - completed) / rate);
      const etaStr = `${Math.floor(eta / 60)}m${eta % 60}s`;
      const pct = Math.round((completed / total) * 100);

      if (result.saved) {
        saved++;
        const p = result.profile!;
        const tags = [
          p.title,
          p.israeliRating ? `IL:${p.israeliRating}` : null,
          p.fideRatingStandard ? `FIDE:${p.fideRatingStandard}` : null,
          p.birthYear ? `b.${p.birthYear}` : null,
        ].filter(Boolean).join(" ");
        console.log(`[${pct}% ${completed}/${total} ETA:${etaStr}] ✓ ${entry.name} ${tags}`);
      } else {
        failed++;
        console.log(`[${pct}%] ✗ ${entry.israeliId} (${entry.name}): ${result.reason}`);
      }

      processedSet.add(entry.israeliId);
      checkpoint.processed.push(entry.israeliId);
      dirty++;

      if (!isDryRun && dirty >= 20) {
        saveCheckpoint(checkpoint);
        dirty = 0;
      }
    }
  }

  const actualWorkers = Math.min(numWorkers, queue.length);
  console.log(`\nLaunching ${actualWorkers} workers for ${total} players (delay: ${delayMs}ms)...\n`);

  await Promise.all(Array.from({ length: actualWorkers }, (_, i) => worker(i)));

  if (!isDryRun && dirty > 0) saveCheckpoint(checkpoint);

  return { saved, failed };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== chess.org.il Full Rankings Scraper ===");
  if (isDryRun) console.log("[DRY RUN — no DB writes]");
  if (isResume) console.log("[RESUME mode — skipping already processed]");

  // Single player mode
  if (playerOnly) {
    console.log(`\nScraping single player ID: ${playerOnly}`);
    const result = await processOne(playerOnly, undefined, isDryRun);
    if (result.saved && result.profile) {
      const p = result.profile;
      console.log(`✓ ${p.name}`);
      console.log(`  Israeli ID: ${p.israeliId}`);
      console.log(`  FIDE ID: ${p.fideId ?? "—"}`);
      console.log(`  Birth year: ${p.birthYear ?? "—"}`);
      console.log(`  Israeli rating: ${p.israeliRating} (expected: ${p.expectedRating ?? "—"})`);
      console.log(`  FIDE standard: ${p.fideRatingStandard ?? "—"}`);
      console.log(`  FIDE rapid: ${p.fideRatingRapid ?? "—"}`);
      console.log(`  FIDE blitz: ${p.fideRatingBlitz ?? "—"}`);
      console.log(`  Title: ${p.title ?? "—"} / ${p.israeliTitle ?? "—"}`);
      console.log(`  Club: ${p.club ?? "—"}`);
      console.log(`  Rank: ${p.israeliRank ?? "—"}`);
      console.log(`  Card active: ${p.cardActive ?? "—"}`);
    } else {
      console.log(`✗ ${result.reason}`);
    }
    await prisma.$disconnect();
    return;
  }

  const checkpoint = loadCheckpoint();

  // Phase 1: Fetch all ranking pages
  let rankings = checkpoint.rankings;
  if (!checkpoint.rankingsFetched || rankings.length === 0) {
    console.log(`\nPhase 1: Fetching ranking pages (max ${maxPages} pages)...`);
    const session = new CookieSession();
    rankings = await scrapeAllRankingPages(session, maxPages, delayMs);
    console.log(`→ Found ${rankings.length} players in ranking list\n`);

    checkpoint.rankings = rankings;
    checkpoint.rankingsFetched = true;
    if (!isDryRun) saveCheckpoint(checkpoint);
  } else {
    console.log(`\nPhase 1: Loaded ${rankings.length} players from checkpoint\n`);
  }

  if (rankings.length === 0) {
    console.log("No players found. Check the site or your connection.");
    await prisma.$disconnect();
    return;
  }

  // Phase 2: Fetch full profiles concurrently
  console.log("Phase 2: Fetching full profiles...");
  const processedSet = new Set(checkpoint.processed);
  const remaining = rankings.filter(r => !processedSet.has(r.israeliId)).length;
  console.log(`Total: ${rankings.length} | Done: ${processedSet.size} | Remaining: ${remaining}`);

  if (remaining === 0) {
    console.log("All players already processed!");
    await prisma.$disconnect();
    return;
  }

  const { saved, failed } = await runWorkerPool(rankings, processedSet, checkpoint);

  console.log("\n=== Summary ===");
  console.log(`Saved: ${saved} | Failed: ${failed}`);

  if (!isDryRun) {
    const total = await prisma.player.count({ where: { country: "ISR" } });
    const withBirth = await prisma.player.count({ where: { country: "ISR", birthYear: { not: null } } });
    const withTitle = await prisma.player.count({ where: { country: "ISR", title: { not: null } } });
    console.log(`\nIsraeli players in DB: ${total}`);
    console.log(`  With birth year: ${withBirth}`);
    console.log(`  With title: ${withTitle}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  prisma.$disconnect();
  process.exit(1);
});
