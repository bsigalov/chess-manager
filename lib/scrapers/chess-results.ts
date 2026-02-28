import * as cheerio from "cheerio";
import {
  delay,
  fetchPage,
  parseChessResultsTable,
  parseResult,
  parseRating,
  parseTitle,
  parseCrosstableCell,
} from "./chess-results-parser";
import type { CrosstableEntry } from "@/lib/types/tournament";

const DEFAULT_BASE_URL = "https://chess-results.com";
const DELAY_MS = 2000;

export function parseTournamentUrl(url: string): string {
  const match = url.match(/tnr(\d+)/);
  if (!match) throw new Error("Invalid chess-results.com URL");
  return match[1];
}

/**
 * Extract the base URL (scheme + host) from a chess-results URL.
 * Chess-results uses subdomain sharding (s2., s4., s8., etc.)
 * and tournaments only exist on their specific subdomain.
 */
export function parseBaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

/**
 * Extract persistent query params from the original URL (e.g. SNode=S0 for
 * multi-tournament pages). These must be forwarded on every request.
 */
export function parsePersistentParams(url: string): Record<string, string> {
  const persistent: Record<string, string> = {};
  try {
    const parsed = new URL(url);
    // SNode selects a specific sub-tournament on multi-tournament pages
    const snode = parsed.searchParams.get("SNode");
    if (snode) persistent.SNode = snode;
  } catch {
    // ignore
  }
  return persistent;
}

function buildUrl(
  tournamentId: string,
  params: Record<string, string> = {},
  baseUrl: string = DEFAULT_BASE_URL
): string {
  const base = `${baseUrl}/tnr${tournamentId}.aspx?lan=1&zeilen=99999`;
  const extra = Object.entries(params)
    .map(([k, v]) => `&${k}=${v}`)
    .join("");
  return base + extra;
}

export interface TournamentInfo {
  name: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  startDate: string | null;
  endDate: string | null;
  rounds: number;
  currentRound: number;
  timeControl: string | null;
  tournamentType: string | null;
  status: string;
}

export async function scrapeTournamentInfo(
  tournamentId: string,
  baseUrl?: string,
  extraParams?: Record<string, string>
): Promise<TournamentInfo> {
  const html = await fetchPage(buildUrl(tournamentId, { ...extraParams }, baseUrl));
  const $ = cheerio.load(html);

  const name =
    $("h2").first().text().trim() ||
    $(".defaultDialog h2").text().trim() ||
    "Unknown Tournament";

  const infoText = $(".defaultDialog").text() || $("body").text();

  const dateMatch = infoText.match(
    /(\d{4}\/\d{2}\/\d{2})\s*[-\u2013to]+\s*(\d{4}\/\d{2}\/\d{2})/
  );
  const roundMatch = infoText.match(/(\d+)\s*Rounds?/i);
  const currentRoundMatch = infoText.match(/Round\s*(\d+)/i);

  let venue: string | null = null;
  let city: string | null = null;
  let country: string | null = null;

  $("table tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length >= 2) {
      const label = cells.eq(0).text().trim().toLowerCase();
      const value = cells.eq(1).text().trim();
      if (label.includes("venue") || label.includes("location")) venue = value;
      if (label.includes("city")) city = value;
      if (label.includes("country") || label.includes("federation"))
        country = value;
    }
  });

  const rounds = roundMatch ? parseInt(roundMatch[1], 10) : 0;
  const currentRound = currentRoundMatch
    ? parseInt(currentRoundMatch[1], 10)
    : 0;
  const isCompleted = currentRound >= rounds && rounds > 0;

  return {
    name,
    venue,
    city,
    country,
    startDate: dateMatch ? dateMatch[1] : null,
    endDate: dateMatch ? dateMatch[2] : null,
    rounds,
    currentRound,
    timeControl: null,
    tournamentType: null,
    status: isCompleted ? "completed" : "ongoing",
  };
}

export interface PlayerEntry {
  startingRank: number;
  name: string;
  title: string | null;
  rating: number | null;
  fideId: string | null;
  federation: string | null;
}

export async function scrapePlayerList(
  tournamentId: string,
  baseUrl?: string,
  extraParams?: Record<string, string>
): Promise<PlayerEntry[]> {
  await delay(DELAY_MS);
  const html = await fetchPage(buildUrl(tournamentId, { ...extraParams, art: "0" }, baseUrl));
  const rows = parseChessResultsTable(html);

  const players: PlayerEntry[] = [];
  for (const row of rows) {
    if (row.length < 3) continue;
    const rank = parseInt(row[0], 10);
    if (isNaN(rank)) continue;

    const titleCell = row.length > 2 ? row[1] : "";
    const title = parseTitle(titleCell);
    let nameIdx = title ? 2 : 1;
    let name = (row[nameIdx] || "").trim();
    // Handle empty title column: if name cell is empty, try the next column
    if (!name && nameIdx + 1 < row.length) {
      nameIdx++;
      name = (row[nameIdx] || "").trim();
    }
    if (!name) continue;

    let rating: number | null = null;
    let fideId: string | null = null;
    let federation: string | null = null;

    for (let i = nameIdx + 1; i < row.length; i++) {
      const cell = row[i];
      if (!rating) {
        const r = parseRating(cell);
        if (r) {
          rating = r;
          continue;
        }
      }
      if (!federation && /^[A-Z]{3}$/.test(cell.trim())) {
        federation = cell.trim();
        continue;
      }
      if (!fideId && /^\d{5,}$/.test(cell.trim())) {
        fideId = cell.trim();
        continue;
      }
    }

    players.push({ startingRank: rank, name, title, rating, fideId, federation });
  }
  return players;
}

export interface StandingsEntry {
  rank: number;
  name: string;
  rating: number | null;
  points: number;
  tiebreak1: number | null;
  tiebreak2: number | null;
  performance: number | null;
  gamesPlayed: number | null;
}

export async function scrapeStandings(
  tournamentId: string,
  round?: number,
  baseUrl?: string,
  extraParams?: Record<string, string>
): Promise<StandingsEntry[]> {
  await delay(DELAY_MS);
  // Use art=1 (Final Ranking) — cleaner table than art=4 (crosstable)
  const params: Record<string, string> = { ...extraParams, art: "1" };
  if (round) params.rd = String(round);
  const html = await fetchPage(buildUrl(tournamentId, params, baseUrl));

  // Extract total rounds from subtitle: "Final Ranking after 9 Rounds"
  const $ = cheerio.load(html);
  let totalRounds: number | null = null;
  $("h2").each((_, el) => {
    const text = $(el).text();
    const m = text.match(/after\s+(\d+)\s+Rounds?/i);
    if (m) totalRounds = parseInt(m[1], 10);
  });

  const rows = parseChessResultsTable(html);

  const standings: StandingsEntry[] = [];
  for (const row of rows) {
    if (row.length < 4) continue;
    const rank = parseInt(row[0], 10);
    if (isNaN(rank)) continue;

    // Columns: Rk.(0), SNo(1), [title], Name, FED, Rtg, Pts., TB1..TBn
    // Title column may be empty — detect by checking for known title
    let idx = 2; // start after SNo
    let title: string | null = null;
    if (idx < row.length && parseTitle(row[idx])) {
      title = parseTitle(row[idx]);
      idx++;
    } else if (idx < row.length && row[idx].trim() === "") {
      // Empty title column
      idx++;
    }

    // Name column
    const name = (idx < row.length ? row[idx] : "").trim();
    if (!name) continue;
    idx++;

    // Federation (3-letter code)
    let federation: string | null = null;
    if (idx < row.length && /^[A-Z]{3}$/.test(row[idx].trim())) {
      federation = row[idx].trim();
      idx++;
    }

    // Rating (number > 100)
    let rating: number | null = null;
    if (idx < row.length) {
      const r = parseRating(row[idx]);
      if (r) {
        rating = r;
        idx++;
      }
    }

    // Skip non-numeric columns (e.g., Club/City) to reach the points column
    while (idx < row.length) {
      const trimmed = row[idx].replace(",", ".").trim();
      const asFloat = parseFloat(trimmed);
      if (!isNaN(asFloat)) break; // Found a numeric column
      idx++;
    }

    // Points (decimal like "8" or "7,5" or "7.5")
    let points = 0;
    if (idx < row.length) {
      const pStr = row[idx].replace(",", ".").trim();
      const p = parseFloat(pStr);
      if (!isNaN(p) && p <= 100) {
        points = p;
        idx++;
      }
    }

    // Remaining columns are tiebreaks — extract first two
    const tbCols = row.slice(idx);
    let tb1: number | null = null;
    let tb2: number | null = null;
    if (tbCols.length >= 1) {
      const v = parseFloat(tbCols[0].replace(",", "."));
      if (!isNaN(v)) tb1 = v;
    }
    if (tbCols.length >= 2) {
      const v = parseFloat(tbCols[1].replace(",", "."));
      if (!isNaN(v)) tb2 = v;
    }

    standings.push({
      rank,
      name,
      rating,
      points,
      tiebreak1: tb1,
      tiebreak2: tb2,
      performance: null, // art=1 doesn't include performance rating
      gamesPlayed: totalRounds,
    });
  }
  return standings;
}

export interface PairingEntry {
  board: number;
  whiteName: string;
  blackName: string;
  whiteRating: number | null;
  blackRating: number | null;
  result: string | null;
}

/**
 * Detect whether a cell looks like a game result.
 * Patterns: "1 - 0", "½ - ½", "0 - 1", "+:-", "-:+", etc.
 */
function isResultCell(cell: string): boolean {
  const s = cell.trim();
  if (!s) return false;
  if (s.includes(" - ")) return true;
  if (s.includes("\u00bd")) return true; // ½
  if (s.includes("+:-") || s.includes("-:+")) return true;
  if (s === "+" || s === "-") return true;
  // "1 - 0" style without spaces handled by " - " above
  return false;
}

export async function scrapePairings(
  tournamentId: string,
  round: number,
  baseUrl?: string,
  extraParams?: Record<string, string>
): Promise<PairingEntry[]> {
  await delay(DELAY_MS);
  const html = await fetchPage(
    buildUrl(tournamentId, { ...extraParams, art: "2", rd: String(round) }, baseUrl)
  );
  const rows = parseChessResultsTable(html);

  const pairings: PairingEntry[] = [];
  for (const row of rows) {
    if (row.length < 4) continue;
    const board = parseInt(row[0], 10);
    if (isNaN(board)) continue;

    // Find the result column by pattern matching
    let resultIdx = -1;
    for (let i = 1; i < row.length; i++) {
      if (isResultCell(row[i])) {
        resultIdx = i;
        break;
      }
    }
    if (resultIdx === -1) continue;

    // White data: columns between board (0) and result
    // Format: [title?] Name Rtg [Pts.]
    const whiteCols = row.slice(1, resultIdx);
    // Black data: columns after result
    // Format: [Pts.] [title?] Name Rtg
    const blackCols = row.slice(resultIdx + 1);

    const white = extractPlayerFromCols(whiteCols);
    const black = extractPlayerFromCols(blackCols);

    if (!white.name && !black.name) continue;

    pairings.push({
      board,
      whiteName: white.name.trim(),
      blackName: black.name.trim(),
      whiteRating: white.rating,
      blackRating: black.rating,
      result: parseResult(row[resultIdx]),
    });
  }
  return pairings;
}

/**
 * Extract player name and rating from a slice of table columns.
 * Handles optional title column and trailing points column.
 */
function extractPlayerFromCols(cols: string[]): {
  name: string;
  rating: number | null;
} {
  if (cols.length === 0) return { name: "", rating: null };

  let name = "";
  let rating: number | null = null;

  // Walk through columns, skipping title, points-like values, and picking up name + rating
  for (const col of cols) {
    const trimmed = col.trim();
    if (!trimmed) continue;

    // Skip if it's a known title
    if (parseTitle(trimmed)) continue;

    // Check if it's a rating (integer > 100)
    const asNum = parseInt(trimmed, 10);
    if (!isNaN(asNum) && String(asNum) === trimmed && asNum > 100) {
      rating = asNum;
      continue;
    }

    // Skip points-like values (e.g. "4", "3,5", "7.5")
    if (/^\d+([.,]\d+)?$/.test(trimmed) && parseFloat(trimmed.replace(",", ".")) <= 100) {
      continue;
    }

    // Otherwise it's the player name (take the first non-skipped text)
    if (!name) {
      name = trimmed;
    }
  }

  return { name, rating };
}

/**
 * Scrape the crosstable (art=4) — dense NxN round-by-round data.
 * Each row: Rk, [Title], Name, Rtg, FED, 1.Rd, 2.Rd, ..., Pts.
 * Round cells: "13w1" = played rank 13 as white, won.
 */
export async function scrapeCrosstable(
  tournamentId: string,
  baseUrl?: string,
  extraParams?: Record<string, string>
): Promise<CrosstableEntry[]> {
  await delay(DELAY_MS);
  const html = await fetchPage(
    buildUrl(tournamentId, { ...extraParams, art: "4" }, baseUrl)
  );
  const rows = parseChessResultsTable(html);

  // Detect round columns from header row.
  // Header: ["Rk.", "", "Name", "Rtg", "FED", "1.Rd", "2.Rd", ..., "Pts."]
  let roundStartIdx = -1;
  let roundEndIdx = -1;
  const headerRow = rows[0];
  if (headerRow) {
    for (let i = 0; i < headerRow.length; i++) {
      if (/^\d+\.?\s*Rd/i.test(headerRow[i].trim())) {
        if (roundStartIdx === -1) roundStartIdx = i;
        roundEndIdx = i;
      }
    }
  }

  if (roundStartIdx === -1) return [];
  const totalRounds = roundEndIdx - roundStartIdx + 1;

  const entries: CrosstableEntry[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < roundStartIdx + totalRounds) continue;

    const rank = parseInt(row[0], 10);
    if (isNaN(rank)) continue;

    // Parse title, name, rating, federation from columns 1..roundStartIdx-1
    let idx = 1;
    let title: string | null = null;
    if (idx < roundStartIdx && parseTitle(row[idx])) {
      title = parseTitle(row[idx]);
      idx++;
    } else if (idx < roundStartIdx && row[idx].trim() === "") {
      // Empty title column for untitled players
      idx++;
    }

    const name = (idx < roundStartIdx ? row[idx] : "").trim();
    if (!name) continue;
    idx++;

    let rating: number | null = null;
    let federation: string | null = null;
    while (idx < roundStartIdx) {
      const cell = row[idx].trim();
      if (!rating) {
        const r = parseRating(cell);
        if (r) { rating = r; idx++; continue; }
      }
      if (!federation && /^[A-Z]{3}$/.test(cell)) {
        federation = cell;
      }
      idx++;
    }

    // Parse round results
    const roundResults = [];
    for (let round = 0; round < totalRounds; round++) {
      const cellIdx = roundStartIdx + round;
      const cellText = cellIdx < row.length ? row[cellIdx] : "";
      roundResults.push(parseCrosstableCell(cellText, round + 1));
    }

    // Parse total points (last column after round columns)
    const ptsIdx = roundStartIdx + totalRounds;
    let points = 0;
    if (ptsIdx < row.length) {
      const p = parseFloat(row[ptsIdx].replace(",", "."));
      if (!isNaN(p)) points = p;
    }

    entries.push({
      startingRank: rank,
      name,
      title,
      rating,
      federation,
      points,
      roundResults,
    });
  }

  return entries;
}
