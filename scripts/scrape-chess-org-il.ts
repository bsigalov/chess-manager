#!/usr/bin/env tsx
/**
 * scrape-chess-org-il.ts
 * CLI script to scrape Israeli chess players from chess.org.il
 *
 * Optimized flow:
 *   Phase 1: Bulk-fetch all active players via SearchPlayers.aspx (~10 pages of 250)
 *   Phase 2: Per-player rating history only (1 request each, N concurrent workers)
 *
 * Total requests: ~10 search pages + ~2000 rating history ≈ 2010
 * (vs ~6000 before: ranking + profile + tournaments + rating per player)
 *
 * Usage:
 *   npx tsx scripts/scrape-chess-org-il.ts                    # full run (5 workers)
 *   npx tsx scripts/scrape-chess-org-il.ts --workers 10       # 10 concurrent workers
 *   npx tsx scripts/scrape-chess-org-il.ts --dry-run
 *   npx tsx scripts/scrape-chess-org-il.ts --detect-rate
 *   npx tsx scripts/scrape-chess-org-il.ts --player-only 205758
 *   npx tsx scripts/scrape-chess-org-il.ts --delay-ms 1000
 *   npx tsx scripts/scrape-chess-org-il.ts --legacy           # old ranking-based flow
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import {
  CookieSession,
  SearchPlayerEntry,
  RatingEntry,
  scrapeSearchPlayers,
  scrapePlayerProfile,
  scrapePlayerRatingHistory,
  scrapeAllRankingPages,
  scrapePlayerTournaments,
  computePriority,
  isActivePlayer,
  hasPlayedSince2025,
  detectOptimalDelay,
} from "../lib/scrapers/chess-org-il";
import { delay } from "../lib/scrapers/chess-results-parser";

// Load env
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

// Import prisma after env is loaded
import { prisma } from "../lib/db";

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const detectRate = args.includes("--detect-rate");
const useLegacy = args.includes("--legacy");
const playerOnlyIdx = args.indexOf("--player-only");
const playerOnly = playerOnlyIdx !== -1 ? parseInt(args[playerOnlyIdx + 1], 10) : undefined;
const pagesIdx = args.indexOf("--pages");
const maxPages = pagesIdx !== -1 ? parseInt(args[pagesIdx + 1], 10) : 20;
const delayIdx = args.indexOf("--delay-ms");
const explicitDelay = delayIdx !== -1 ? parseInt(args[delayIdx + 1], 10) : undefined;
const workersIdx = args.indexOf("--workers");
const numWorkers = workersIdx !== -1 ? parseInt(args[workersIdx + 1], 10) : 5;

// ─── Checkpoint ──────────────────────────────────────────────────────────────

const CHECKPOINT_PATH = path.join(process.cwd(), "scripts", ".scrape-progress.json");

interface Checkpoint {
  searchFetched: boolean;
  players: SearchPlayerEntry[];
  processed: number[];
}

function loadCheckpoint(): Checkpoint {
  if (fs.existsSync(CHECKPOINT_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf-8"));
    } catch {
      // corrupted — start fresh
    }
  }
  return { searchFetched: false, players: [], processed: [] };
}

function saveCheckpoint(cp: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

// ─── DB upsert helpers ────────────────────────────────────────────────────────

async function upsertFromSearchEntry(entry: SearchPlayerEntry): Promise<string> {
  const metadataPayload = JSON.parse(JSON.stringify({
    israeliId: entry.israeliId,
    israeliRating: entry.israeliRating,
    fideRating: entry.fideRating,
    cardValidUntil: entry.cardValidUntil,
    club: entry.club,
    title: entry.title,
    country: entry.country,
    gender: entry.gender,
    tournamentCount: entry.tournamentCount,
    source: "chess-org-il",
  }));

  // Try by fideId first
  if (entry.fideId) {
    const existing = await prisma.player.findUnique({ where: { fideId: entry.fideId } });
    if (existing) {
      // Keep English name as canonical; store Hebrew as alias if different
      const keepName = existing.name;
      if (entry.name !== existing.name) {
        await prisma.playerAlias.upsert({
          where: { playerId_alias: { playerId: existing.id, alias: entry.name } },
          update: { source: "chess-org-il" },
          create: { playerId: existing.id, alias: entry.name, source: "chess-org-il" },
        });
      }
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          name: keepName,
          rating: entry.israeliRating,
          birthYear: entry.birthYear ?? existing.birthYear,
          country: "ISR",
          isActive: true,
          metadata: metadataPayload,
        },
      });
      return existing.id;
    }
  }

  // Try by israeliId in metadata
  const byIsraeliId = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM players WHERE metadata->>'israeliId' = ${String(entry.israeliId)} LIMIT 1
  `;
  if (byIsraeliId.length > 0) {
    const existingId = byIsraeliId[0].id;
    const existingName = byIsraeliId[0].name;
    // Keep English name as canonical; store Hebrew as alias if different
    if (entry.name !== existingName) {
      await prisma.playerAlias.upsert({
        where: { playerId_alias: { playerId: existingId, alias: entry.name } },
        update: { source: "chess-org-il" },
        create: { playerId: existingId, alias: entry.name, source: "chess-org-il" },
      });
    }
    await prisma.player.update({
      where: { id: existingId },
      data: {
        name: existingName,
        rating: entry.israeliRating,
        birthYear: entry.birthYear,
        country: "ISR",
        isActive: true,
        metadata: metadataPayload,
      },
    });
    return existingId;
  }

  // Create new
  const created = await prisma.player.create({
    data: {
      name: entry.name,
      fideId: entry.fideId,
      rating: entry.israeliRating,
      birthYear: entry.birthYear,
      country: "ISR",
      isActive: true,
      metadata: metadataPayload,
    },
  });
  return created.id;
}

async function upsertRatingHistory(
  playerId: string,
  entries: RatingEntry[]
): Promise<void> {
  if (entries.length === 0) return;
  await prisma.ratingHistory.deleteMany({
    where: { playerId, ratingType: "israeli" },
  });
  await prisma.ratingHistory.createMany({
    data: entries.map((e) => ({
      playerId,
      ratingType: "israeli",
      rating: e.rating,
      source: "chess-org-il",
      recordedAt: e.recordedAt,
    })),
  });
}

// ─── Process single player (rating history only) ─────────────────────────────

async function processPlayer(
  session: CookieSession,
  entry: SearchPlayerEntry,
  delayMs: number,
  dryRun: boolean
): Promise<{ saved: boolean; reason?: string; ratingPoints?: number }> {
  try {
    const ratingHistory = await scrapePlayerRatingHistory(session, entry.israeliId, delayMs);

    if (dryRun) {
      return { saved: true, ratingPoints: ratingHistory.length };
    }

    await prisma.$transaction(async () => {
      const playerId = await upsertFromSearchEntry(entry);
      await upsertRatingHistory(playerId, ratingHistory);
    });

    return { saved: true, ratingPoints: ratingHistory.length };
  } catch (err) {
    return { saved: false, reason: `error: ${err}` };
  }
}

// ─── Concurrent worker pool ─────────────────────────────────────────────────

interface WorkerStats {
  saved: number;
  failed: number;
}

async function runWorkerPool(
  players: SearchPlayerEntry[],
  processedSet: Set<number>,
  checkpoint: Checkpoint,
  delayMs: number,
  workerCount: number,
): Promise<WorkerStats> {
  const stats: WorkerStats = { saved: 0, failed: 0 };

  const queue = players.filter(p => !processedSet.has(p.israeliId));
  const total = queue.length;
  let queueIdx = 0;
  let completed = 0;
  const startTime = Date.now();
  let checkpointDirty = 0;

  function logProgress(entry: SearchPlayerEntry, result: Awaited<ReturnType<typeof processPlayer>>) {
    completed++;
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = completed / elapsed;
    const eta = Math.round((total - completed) / rate);
    const etaMin = Math.floor(eta / 60);
    const etaSec = eta % 60;
    const pct = Math.round((completed / total) * 100);

    if (result.saved) {
      stats.saved++;
      console.log(`[${pct}% ${completed}/${total} ETA:${etaMin}m${etaSec}s] ✓ ${entry.name} (${entry.israeliRating}) ${result.ratingPoints}rp`);
    } else {
      stats.failed++;
      console.log(`[${pct}%] ✗ ${entry.israeliId}: ${result.reason}`);
    }

    processedSet.add(entry.israeliId);
    checkpoint.processed.push(entry.israeliId);
    checkpointDirty++;

    if (!isDryRun && checkpointDirty >= 20) {
      saveCheckpoint(checkpoint);
      checkpointDirty = 0;
    }
  }

  async function worker(workerId: number) {
    const session = new CookieSession();
    await delay(workerId * 300);

    while (true) {
      const idx = queueIdx++;
      if (idx >= queue.length) break;

      const entry = queue[idx];
      const result = await processPlayer(session, entry, delayMs, isDryRun);
      logProgress(entry, result);
    }
  }

  const actualWorkers = Math.min(workerCount, queue.length);
  console.log(`Launching ${actualWorkers} concurrent workers for ${total} players (delay: ${delayMs}ms)...\n`);

  const workers = Array.from({ length: actualWorkers }, (_, i) => worker(i));
  await Promise.all(workers);

  if (!isDryRun && checkpointDirty > 0) {
    saveCheckpoint(checkpoint);
  }

  return stats;
}

// ─── Legacy flow (ranking-based, for --legacy flag) ──────────────────────────

async function legacyMain(session: CookieSession, delayMs: number) {
  console.log("[LEGACY MODE] Using ranking pages + individual profile scraping\n");
  const entries = await scrapeAllRankingPages(session, maxPages, delayMs);
  console.log(`Fetched ${entries.length} ranking entries.`);

  const players = entries
    .map((e) => ({
      israeliId: e.israeliId,
      name: e.name,
      priority: computePriority(undefined, e.israeliRating),
    }))
    .sort((a, b) => a.priority - b.priority);

  for (const p of players) {
    const profileSession = new CookieSession();
    try {
      const profile = await scrapePlayerProfile(profileSession, p.israeliId);
      await delay(delayMs);
      if (!isActivePlayer(profile)) continue;
      const tournaments = await scrapePlayerTournaments(profileSession, p.israeliId, new Date("2016-01-01"), delayMs);
      if (!hasPlayedSince2025(tournaments)) continue;
      const ratingHistory = await scrapePlayerRatingHistory(profileSession, p.israeliId, delayMs);
      console.log(`✓ ${profile.name} (${profile.israeliRating}) — ${ratingHistory.length}rp`);
    } catch (err) {
      console.log(`✗ ${p.israeliId}: ${err}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== chess.org.il Scraper (v2 — bulk search) ===");
  if (isDryRun) console.log("[DRY RUN mode — no DB writes]");

  const session = new CookieSession();

  // Detect or use delay
  let delayMs = explicitDelay ?? 1000;
  if (detectRate) {
    console.log("\nDetecting optimal rate limit...");
    delayMs = await detectOptimalDelay(session);
  }
  console.log(`Using delay: ${delayMs}ms, workers: ${numWorkers}\n`);

  // Single player mode (still uses individual scraping)
  if (playerOnly) {
    console.log(`Processing single player ID: ${playerOnly}`);
    const ratingHistory = await scrapePlayerRatingHistory(session, playerOnly, delayMs);
    console.log(`✓ Player ${playerOnly} — ${ratingHistory.length} rating points`);
    await prisma.$disconnect();
    return;
  }

  // Legacy mode
  if (useLegacy) {
    await legacyMain(session, delayMs);
    await prisma.$disconnect();
    return;
  }

  // Load checkpoint
  const checkpoint = loadCheckpoint();
  let players = checkpoint.players;

  // Phase 1: Bulk fetch all players via search page
  if (!checkpoint.searchFetched || players.length === 0) {
    console.log("Phase 1: Fetching all active players via SearchPlayers.aspx...");
    players = await scrapeSearchPlayers(
      session,
      { activeCardOnly: true, activeOnly: true },
      delayMs
    );
    console.log(`\nFetched ${players.length} active players with valid cards.\n`);

    // Sort by priority (youth near 1800 first)
    players.sort((a, b) =>
      computePriority(a.birthYear, a.israeliRating) -
      computePriority(b.birthYear, b.israeliRating)
    );

    checkpoint.searchFetched = true;
    checkpoint.players = players;
    if (!isDryRun) saveCheckpoint(checkpoint);
  }

  const processedSet = new Set(checkpoint.processed);
  const remaining = players.filter(p => !processedSet.has(p.israeliId)).length;
  console.log(`Total: ${players.length} | Already processed: ${processedSet.size} | Remaining: ${remaining}\n`);

  if (remaining === 0) {
    console.log("All players already processed!");
    await prisma.$disconnect();
    return;
  }

  // Phase 2: Fetch rating history per player (concurrent)
  console.log("Phase 2: Fetching rating history per player...");
  const stats = await runWorkerPool(players, processedSet, checkpoint, delayMs, numWorkers);

  console.log("\n=== Summary ===");
  console.log(`Saved to DB: ${stats.saved}`);
  console.log(`Failed (errors): ${stats.failed}`);

  if (!isDryRun) {
    const totalPlayers = await prisma.player.count({ where: { country: "ISR" } });
    console.log(`\nTotal Israeli players in DB: ${totalPlayers}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  prisma.$disconnect();
  process.exit(1);
});
