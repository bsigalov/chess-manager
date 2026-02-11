import * as cheerio from "cheerio";
import {
  delay,
  fetchPage,
  parseChessResultsTable,
  parseResult,
  parseRating,
  parseTitle,
} from "./chess-results-parser";

const BASE_URL = "https://chess-results.com";
const DELAY_MS = 2000;

export function parseTournamentUrl(url: string): string {
  const match = url.match(/tnr(\d+)/);
  if (!match) throw new Error("Invalid chess-results.com URL");
  return match[1];
}

function buildUrl(
  tournamentId: string,
  params: Record<string, string> = {}
): string {
  const base = `${BASE_URL}/tnr${tournamentId}.aspx?lan=1`;
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
  tournamentId: string
): Promise<TournamentInfo> {
  const html = await fetchPage(buildUrl(tournamentId));
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
  tournamentId: string
): Promise<PlayerEntry[]> {
  await delay(DELAY_MS);
  const html = await fetchPage(buildUrl(tournamentId, { art: "0" }));
  const rows = parseChessResultsTable(html);

  const players: PlayerEntry[] = [];
  for (const row of rows) {
    if (row.length < 3) continue;
    const rank = parseInt(row[0], 10);
    if (isNaN(rank)) continue;

    const titleCell = row.length > 2 ? row[1] : "";
    const title = parseTitle(titleCell);
    const nameIdx = title ? 2 : 1;
    const name = row[nameIdx] || "";
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
}

export async function scrapeStandings(
  tournamentId: string,
  round?: number
): Promise<StandingsEntry[]> {
  await delay(DELAY_MS);
  const params: Record<string, string> = { art: "4" };
  if (round) params.rd = String(round);
  const html = await fetchPage(buildUrl(tournamentId, params));
  const rows = parseChessResultsTable(html);

  const standings: StandingsEntry[] = [];
  for (const row of rows) {
    if (row.length < 4) continue;
    const rank = parseInt(row[0], 10);
    if (isNaN(rank)) continue;

    const name = row[1] || "";
    if (!name) continue;

    let rating: number | null = null;
    let points = 0;

    for (let i = 2; i < row.length; i++) {
      const val = parseFloat(row[i]);
      if (isNaN(val)) continue;
      if (!rating && val > 1000) {
        rating = Math.round(val);
        continue;
      }
      if (val <= 100) {
        points = val;
        break;
      }
    }

    const numericCells = row
      .slice(2)
      .map((c) => parseFloat(c))
      .filter((n) => !isNaN(n));
    let tb1: number | null = null;
    let tb2: number | null = null;
    let perf: number | null = null;
    if (numericCells.length >= 4) {
      tb1 = numericCells[numericCells.length - 3] ?? null;
      tb2 = numericCells[numericCells.length - 2] ?? null;
      const lastVal = numericCells[numericCells.length - 1];
      perf = lastVal > 1000 ? Math.round(lastVal) : null;
    }

    standings.push({
      rank,
      name,
      rating,
      points,
      tiebreak1: tb1,
      tiebreak2: tb2,
      performance: perf,
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

export async function scrapePairings(
  tournamentId: string,
  round: number
): Promise<PairingEntry[]> {
  await delay(DELAY_MS);
  const html = await fetchPage(
    buildUrl(tournamentId, { art: "2", rd: String(round) })
  );
  const rows = parseChessResultsTable(html);

  const pairings: PairingEntry[] = [];
  for (const row of rows) {
    if (row.length < 4) continue;
    const board = parseInt(row[0], 10);
    if (isNaN(board)) continue;

    const whiteName = row[1] || "";
    const blackName =
      row.length > 3 ? row[row.length - 2] || row[3] || "" : row[2] || "";
    const resultStr = row[row.length - 1] || "";

    pairings.push({
      board,
      whiteName: whiteName.trim(),
      blackName: blackName.trim(),
      whiteRating: null,
      blackRating: null,
      result: parseResult(resultStr),
    });
  }
  return pairings;
}
