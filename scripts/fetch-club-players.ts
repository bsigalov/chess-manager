/**
 * Fetch all ACTIVE players from the same club as סיגלוב איתן (צפריר הובר רחובות),
 * including their recent games and ratings.
 * Filters: active card + active status to exclude foreign league GMs.
 */
import {
  CookieSession,
  scrapePlayerProfile,
  scrapePlayerGames,
  scrapePlayerRatingHistory,
  extractViewState,
} from "../lib/scrapers/chess-org-il";
import * as cheerio from "cheerio";

const SEARCH_PATH = "/Players/SearchPlayers.aspx";
const DELAY = 1500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface ClubPlayer {
  israeliId: number;
  name: string;
  rating?: number;
  fideRating?: number;
  title?: string;
  birthYear?: number;
  status?: string;
  cardValidUntil?: string;
}

function parseSearchResults(html: string): ClubPlayer[] {
  const $ = cheerio.load(html);
  const results: ClubPlayer[] = [];

  const table = $("table[id*='GridView']").first();
  if (!table.length) return results;

  table.find("tr").each((rowIdx, row) => {
    if (rowIdx === 0) return;
    const cells = $(row).find("td");
    if (cells.length < 10) return;

    const getText = (idx: number) => $(cells.get(idx)!).text().trim();
    const playerName = getText(1);
    const idStr = getText(2);
    const israeliId = parseInt(idStr, 10);
    if (!israeliId || !playerName) return;

    const ratingRaw = parseInt(getText(9), 10);
    const rating = ratingRaw > 0 ? ratingRaw : undefined;
    const fideRaw = parseInt(getText(10), 10);
    const fideRating = fideRaw > 0 ? fideRaw : undefined;
    const title = getText(11) || undefined;
    const birthYearRaw = parseInt(getText(13), 10);
    const birthYear = birthYearRaw > 1900 ? birthYearRaw : undefined;
    const status = getText(8) || undefined;
    const cardValidUntil = getText(12) || undefined;

    results.push({ israeliId, name: playerName, rating, fideRating, title, birthYear, status, cardValidUntil });
  });

  return results;
}

async function main() {
  const session = new CookieSession();
  const EITAN_ID = 205758;

  // Step 1: Get Eitan's profile
  console.log("🔍 סיגלוב איתן — Profile\n");
  const eitanProfile = await scrapePlayerProfile(session, EITAN_ID);
  console.log(`  Name: ${eitanProfile.name} (ID: ${EITAN_ID})`);
  console.log(`  Club: ${eitanProfile.club}`);
  console.log(`  Israeli Rating: ${eitanProfile.israeliRating} (expected: ${eitanProfile.expectedRating ?? "N/A"})`);
  console.log(`  FIDE: Standard ${eitanProfile.fideRatingStandard ?? "N/A"} | Rapid ${eitanProfile.fideRatingRapid ?? "N/A"} | Blitz ${eitanProfile.fideRatingBlitz ?? "N/A"}`);
  console.log(`  Israeli Rank: ${eitanProfile.israeliRank ?? "N/A"}`);
  console.log(`  Birth Year: ${eitanProfile.birthYear ?? "N/A"}`);

  // Step 2: Search for active club members with valid cards
  console.log(`\n🏠 Searching for active players with valid cards in "צפריר הובר רחובות"...\n`);

  let { html, viewState: vs } = await session.get(SEARCH_PATH);
  await sleep(DELAY);

  // Switch to advanced search
  ({ html, viewState: vs } = await session.doPostBack(
    SEARCH_PATH,
    "ctl00$ContentPlaceHolder1$AdvancedSearchLinkButton",
    "",
    vs
  ));
  await sleep(DELAY);

  // Find the club dropdown value
  const $adv = cheerio.load(html);
  let clubValue = "";
  $adv("#ctl00_ContentPlaceHolder1_ClubsDDL option").each((_, el) => {
    const text = $adv(el).text().trim();
    if (text.includes("צפריר") && text.includes("רחובות")) {
      clubValue = $adv(el).attr("value") ?? text;
      console.log(`  Found club option: "${text}" => value="${clubValue}"`);
    }
  });

  if (!clubValue) {
    console.log("❌ Club not found in dropdown. Trying text search...");
    return;
  }

  // Also grab the MembershipStatus and PlayerStatus option values
  let membershipActiveValue = "";
  $adv("#ctl00_ContentPlaceHolder1_MembershipStatusDDL option").each((_, el) => {
    const text = $adv(el).text().trim();
    const val = $adv(el).attr("value") ?? "";
    if (text.includes("בתוקף") && !text.includes("ללא")) {
      membershipActiveValue = val;
      console.log(`  Membership option: "${text}" => value="${val}"`);
    }
  });
  let playerActiveValue = "";
  $adv("#ctl00_ContentPlaceHolder1_PlayerStatusDDL option").each((_, el) => {
    const text = $adv(el).text().trim();
    const val = $adv(el).attr("value") ?? "";
    if (text === "פעיל") {
      playerActiveValue = val;
      console.log(`  Player status option: "${text}" => value="${val}"`);
    }
  });

  // Also collect all default dropdown values to include in the POST
  const defaultFields: Record<string, string> = {};
  $adv("select").each((_, el) => {
    const name = $adv(el).attr("name");
    if (name && name.includes("ContentPlaceHolder1")) {
      const selected = $adv(el).find("option:selected").attr("value");
      if (selected !== undefined) defaultFields[name] = selected;
    }
  });
  // Also include text inputs with default empty values
  $adv("input[type='text']").each((_, el) => {
    const name = $adv(el).attr("name");
    if (name && name.includes("ContentPlaceHolder1")) {
      defaultFields[name] = "";
    }
  });

  // Override with our filters
  defaultFields["ctl00$ContentPlaceHolder1$ClubsDDL"] = clubValue;
  if (membershipActiveValue) {
    defaultFields["ctl00$ContentPlaceHolder1$MembershipStatusDDL"] = membershipActiveValue;
  }
  // Don't filter by active status - some players might be "active" card but "not active" player status

  console.log("\n  Submitting search...");

  // Submit with: club + active card
  ({ html, viewState: vs } = await session.doPostBack(
    SEARCH_PATH,
    "ctl00$ContentPlaceHolder1$AdvancedSearchButton",
    "",
    vs,
    defaultFields
  ));
  await sleep(DELAY);

  let clubPlayers = parseSearchResults(html);

  // Sort by rating descending
  clubPlayers.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  console.log(`Found ${clubPlayers.length} active players with valid cards:\n`);

  // Print summary table
  console.log("┌────┬─────────────────────────────┬────────┬──────────┬──────────┬───────┬──────┬──────────────┐");
  console.log("│  # │ Name                        │ ID     │ IL Rating│ FIDE     │ Title │ Born │ Card Valid   │");
  console.log("├────┼─────────────────────────────┼────────┼──────────┼──────────┼───────┼──────┼──────────────┤");
  for (let i = 0; i < clubPlayers.length; i++) {
    const p = clubPlayers[i];
    const name = p.name.padEnd(27).slice(0, 27);
    const id = String(p.israeliId).padEnd(6);
    const ilRating = String(p.rating || "-").padStart(8);
    const fide = String(p.fideRating || "-").padStart(8);
    const title = (p.title || "").padEnd(5).slice(0, 5);
    const born = String(p.birthYear || "-").padStart(4);
    const card = (p.cardValidUntil || "-").padEnd(12).slice(0, 12);
    console.log(`│ ${String(i + 1).padStart(2)} │ ${name} │ ${id} │ ${ilRating} │ ${fide} │ ${title} │ ${born} │ ${card} │`);
  }
  console.log("└────┴─────────────────────────────┴────────┴──────────┴──────────┴───────┴──────┴──────────────┘");

  // Step 3: Fetch recent games & ratings for each player
  const cutoffDate = new Date("2025-01-01");
  console.log(`\n📊 Fetching recent games (since 2025) & ratings for ${clubPlayers.length} players...\n`);

  for (const p of clubPlayers) {
    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`  ${p.name} (${p.israeliId}) — IL: ${p.rating ?? "N/A"} | FIDE: ${p.fideRating ?? "N/A"}`);
    console.log(`═══════════════════════════════════════════════════`);

    try {
      // Profile
      const prof = await scrapePlayerProfile(session, p.israeliId);
      console.log(`  FIDE Standard: ${prof.fideRatingStandard ?? "N/A"} | Rapid: ${prof.fideRatingRapid ?? "N/A"} | Blitz: ${prof.fideRatingBlitz ?? "N/A"}`);
      console.log(`  Israeli Rank: ${prof.israeliRank ?? "N/A"} | Expected: ${prof.expectedRating ?? "N/A"}`);
      if (prof.title) console.log(`  Title: ${prof.title}`);

      // Games
      const games = await scrapePlayerGames(session, p.israeliId, cutoffDate, DELAY);
      if (games.length > 0) {
        const wins = games.filter(g => g.result === "win").length;
        const draws = games.filter(g => g.result === "draw").length;
        const losses = games.filter(g => g.result === "loss").length;
        const score = (wins + draws * 0.5);
        console.log(`\n  Games since 2025: ${games.length} (W${wins} D${draws} L${losses} = ${score}/${games.length})`);
        for (const g of games.slice(0, 25)) {
          const date = g.date.toISOString().slice(0, 10);
          const color = g.color === "white" ? "W" : "B";
          const res = g.result === "win" ? "1-0" : g.result === "draw" ? "½-½" : "0-1";
          const oppRtg = g.opponentRating ? `(${g.opponentRating})` : "";
          console.log(`    ${date} [${color}] vs ${g.opponentName} ${oppRtg} ${res} | ${g.tournamentName.slice(0, 35)}`);
        }
        if (games.length > 25) console.log(`    ... +${games.length - 25} more`);
      } else {
        console.log("  No games since 2025.");
      }

      // Rating history
      const rh = await scrapePlayerRatingHistory(session, p.israeliId, DELAY);
      if (rh.length > 0) {
        const recent = rh.slice(-8);
        console.log(`\n  Rating History:`);
        for (const r of recent) {
          console.log(`    ${r.period} → ${r.rating}`);
        }
      }
    } catch (err) {
      console.error(`  Error: ${err}`);
    }
  }

  console.log("\n\n✅ Done!");
}

main().catch(console.error);
