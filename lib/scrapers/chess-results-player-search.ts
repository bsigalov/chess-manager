import * as cheerio from "cheerio";
import { fetchPage, delay } from "./chess-results-parser";

const SEARCH_URL = "https://s3.chess-results.com/spielersuche.aspx?lan=1";
const BASE_URL = "https://chess-results.com";

export interface ChessResultsPlayerTournament {
  name: string;
  url: string;
  endDate: string;
  rounds: number | null;
}

export interface ChessResultsPlayer {
  name: string;
  country: string | null;
  title: string | null;
  fideId: string | null;
  identNumber: string | null;
  tournaments: ChessResultsPlayerTournament[];
}

export interface PlayerSearchParams {
  lastName?: string;
  firstName?: string;
  fideId?: string;
}

function extractViewState(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};
  for (const name of ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]) {
    const val = $(`input[name="${name}"]`).val() as string | undefined;
    if (val) fields[name] = val;
  }
  return fields;
}

function normalizeUrl(href: string): string {
  if (!href) return "";
  // Decode HTML entities
  const decoded = href.replace(/&amp;/g, "&");
  if (decoded.startsWith("http")) return decoded;
  const clean = decoded.replace(/^\.\//, "");
  return `${BASE_URL}/${clean}`;
}

// Column indices based on observed table structure:
// Name | ID | FideID | Club/City | FED | Tournament | End-Date | Rk. | Rd. | n
const COL_NAME = 0;
const COL_FIDE_ID = 2;
const COL_COUNTRY = 4;
const COL_TOURNAMENT = 5;
const COL_END_DATE = 6;
const COL_ROUNDS = 8; // Rd. column

function parseSearchResults(html: string): ChessResultsPlayer[] {
  const $ = cheerio.load(html);
  const playerMap = new Map<string, ChessResultsPlayer>();

  const table = $("table.CRs2").first();
  if (!table.length) return [];

  table.find("tr").each((rowIdx, row) => {
    // Skip header row
    if (rowIdx === 0) return;

    const cells = $(row).find("td");
    if (cells.length < 6) return;

    const cellTexts = cells.map((_, td) => $(td).text().trim()).get();

    // Tournament link — second anchor in the row (first is the player profile link, second is tournament)
    const tournamentAnchors = $(row).find(`td:eq(${COL_TOURNAMENT}) a`);
    const tournamentLink = tournamentAnchors.last();
    if (!tournamentLink.length) return;

    const tournamentName = cellTexts[COL_TOURNAMENT];
    const href = tournamentLink.attr("href") ?? "";
    if (!tournamentName || !href) return;

    const name = cellTexts[COL_NAME];
    if (!name) return;

    const fideId = cellTexts[COL_FIDE_ID] || null;
    const country = cellTexts[COL_COUNTRY] || null;
    const endDate = cellTexts[COL_END_DATE] || "";
    const roundsText = cellTexts[COL_ROUNDS] || "";
    const rounds = parseInt(roundsText, 10) || null;
    const url = normalizeUrl(href);

    const key = `${name}|${fideId ?? ""}|${country ?? ""}`;

    if (!playerMap.has(key)) {
      playerMap.set(key, {
        name,
        country,
        title: null,
        fideId,
        identNumber: null,
        tournaments: [],
      });
    }
    playerMap.get(key)!.tournaments.push({ name: tournamentName, url, endDate, rounds });
  });

  return Array.from(playerMap.values());
}

async function fetchWithViewState(params: PlayerSearchParams): Promise<string> {
  const getHtml = await fetchPage(SEARCH_URL);
  const viewState = extractViewState(getHtml);

  if (!viewState.__VIEWSTATE) {
    throw new Error("Could not extract ViewState from chess-results.com");
  }

  const body = new URLSearchParams({
    ...viewState,
    "ctl00$P1$txt_nachname": params.lastName ?? "",
    "ctl00$P1$txt_vorname": params.firstName ?? "",
    "ctl00$P1$txt_fideID": params.fideId ?? "",
    "ctl00$P1$cb_suchen": "Search",
  });

  await delay(1000);
  return fetchPage(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

async function fetchWithPlaywright(params: PlayerSearchParams): Promise<string> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(SEARCH_URL, { waitUntil: "networkidle" });

    if (params.lastName) await page.fill("input[name='ctl00$P1$txt_nachname']", params.lastName);
    if (params.firstName) await page.fill("input[name='ctl00$P1$txt_vorname']", params.firstName);
    if (params.fideId) await page.fill("input[name='ctl00$P1$txt_fideID']", params.fideId);

    await page.click("input[name='ctl00$P1$cb_suchen']");
    await page.waitForLoadState("networkidle");

    return page.content();
  } finally {
    await browser.close();
  }
}

export async function searchChessResultsPlayers(
  params: PlayerSearchParams
): Promise<ChessResultsPlayer[]> {
  if (!params.lastName && !params.firstName && !params.fideId) {
    throw new Error("At least one search parameter required");
  }

  let html: string;
  try {
    html = await fetchWithViewState(params);
    return parseSearchResults(html);
  } catch (err) {
    if (err instanceof Error && err.message.includes("At least one")) throw err;
    if (err instanceof Error && err.message.includes("ViewState")) throw err;
    // HTTP fetch failed — fall back to Playwright
    html = await fetchWithPlaywright(params);
    return parseSearchResults(html);
  }
}
