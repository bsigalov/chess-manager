/**
 * chess-org-il.ts
 * Scraper for https://www.chess.org.il — Israeli Chess Federation website.
 * Uses native fetch + cheerio (no new dependencies).
 * ASP.NET WebForms site — requires cookie session + __doPostBack simulation.
 */

import * as cheerio from "cheerio";
import { delay } from "./chess-results-parser";

const BASE_URL = "https://www.chess.org.il";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SearchPlayerEntry {
  israeliId: number;
  name: string;
  country: string;
  gender: string;
  tournamentCount: number;
  club: string;
  fideId?: string;
  status: string;
  israeliRating: number;
  fideRating?: number;
  title?: string;
  cardValidUntil?: string;
  birthYear?: number;
}

export interface ViewState {
  __VIEWSTATE: string;
  __VIEWSTATEGENERATOR?: string;
  __EVENTVALIDATION?: string;
}

export interface RankingEntry {
  rank: number;
  israeliId: number;
  name: string;
  israeliRating: number;
  fideRating?: number;
}

export interface PlayerProfile {
  israeliId: number;
  name: string;
  fideId?: string;
  birthYear?: number;
  israeliRating: number;
  expectedRating?: number;
  fideRatingStandard?: number;
  fideRatingRapid?: number;
  fideRatingBlitz?: number;
  title?: string;        // international: GM, IM, FM, CM, WGM, WIM, WFM, WCM
  israeliTitle?: string; // Hebrew title e.g. "רב אמן בינלאומי"
  cardValidUntil?: Date;
  cardActive?: boolean;
  club?: string;
  israeliRank?: number;
}

export interface TournamentEntry {
  date: Date;
  ratingUpdateDate?: Date;
  tournamentName: string;
  israeliTournamentId?: number; // from link href
  games: number;
  points: number;
  performanceRating?: number;
  result: string;
  ratingChange?: number;
}

export interface RatingEntry {
  period: string;
  rating: number;
  recordedAt: Date;
}

export interface GameEntry {
  date: Date;
  tournamentName: string;
  israeliTournamentId?: number; // extracted from tournament link href
  round?: number;               // assigned sequentially per tournament (1-based)
  opponentName: string;
  opponentIsraeliId?: number;   // extracted from opponent link href
  opponentRating?: number;
  color: "white" | "black";
  result: "win" | "loss" | "draw";
}

// ─── Cookie Session ─────────────────────────────────────────────────────────

export class CookieSession {
  private cookies: Map<string, string> = new Map();

  private updateCookies(res: Response): void {
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) return;
    // Multiple Set-Cookie headers come as comma-separated in some runtimes
    const parts = setCookie.split(/,(?=[^ ])/);
    for (const part of parts) {
      const [nameVal] = part.split(";");
      const eqIdx = nameVal.indexOf("=");
      if (eqIdx === -1) continue;
      const name = nameVal.slice(0, eqIdx).trim();
      const value = nameVal.slice(eqIdx + 1).trim();
      if (name) this.cookies.set(name, value);
    }
  }

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  async get(path: string): Promise<{ html: string; viewState: ViewState }> {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Cookie: this.cookieHeader() },
      redirect: "follow",
    });
    this.updateCookies(res);
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    const html = await res.text();
    return { html, viewState: extractViewState(html) };
  }

  async doPostBack(
    path: string,
    target: string,
    argument: string,
    vs: ViewState,
    extraFields?: Record<string, string>
  ): Promise<{ html: string; viewState: ViewState }> {
    const url = `${BASE_URL}${path}`;
    const body = new URLSearchParams({
      __EVENTTARGET: target,
      __EVENTARGUMENT: argument,
      __VIEWSTATE: vs.__VIEWSTATE,
      __VIEWSTATEGENERATOR: vs.__VIEWSTATEGENERATOR ?? "",
      __EVENTVALIDATION: vs.__EVENTVALIDATION ?? "",
      ...extraFields,
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Cookie: this.cookieHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      redirect: "follow",
    });
    this.updateCookies(res);
    if (!res.ok) throw new Error(`POST ${url} → ${res.status}`);
    const html = await res.text();
    return { html, viewState: extractViewState(html) };
  }
}

// ─── ViewState extraction ───────────────────────────────────────────────────

export function extractViewState(html: string): ViewState {
  const $ = cheerio.load(html);
  const get = (name: string) =>
    ($(`input[name="${name}"]`).val() as string | undefined) ?? "";
  return {
    __VIEWSTATE: get("__VIEWSTATE"),
    __VIEWSTATEGENERATOR: get("__VIEWSTATEGENERATOR"),
    __EVENTVALIDATION: get("__EVENTVALIDATION"),
  };
}

// ─── Priority scoring ───────────────────────────────────────────────────────

export function computePriority(
  birthYear: number | undefined,
  israeliRating: number
): number {
  const currentYear = new Date().getFullYear();
  const age = birthYear ? currentYear - birthYear : 50; // unknown = low priority
  const ageDelta = Math.abs(age - 13);
  const ratingDelta = Math.abs(israeliRating - 1800);
  return ageDelta * 10 + ratingDelta / 100; // lower = higher priority
}

// ─── Active player filtering ────────────────────────────────────────────────

export function isActivePlayer(profile: PlayerProfile): boolean {
  if (!profile.cardValidUntil) return false;
  return profile.cardValidUntil > new Date();
}

export function hasPlayedSince2025(tournaments: TournamentEntry[]): boolean {
  const cutoff = new Date("2025-01-01");
  return tournaments.some((t) => t.date >= cutoff);
}

// ─── Parse helpers ──────────────────────────────────────────────────────────

function parseIsraeliDate(text: string): Date | undefined {
  // Formats: "01/01/2024" or "2024-01-01"
  if (!text) return undefined;
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
  const slashMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (slashMatch)
    return new Date(`${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`);
  return undefined;
}

function parseNum(text: string): number | undefined {
  const n = parseInt(text.replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? undefined : n;
}

// ─── Ranking page ───────────────────────────────────────────────────────────

const RANKING_PATH = "/Players/PlayersRanking.aspx";

export async function scrapeRankingPage(
  session: CookieSession,
  page: number,
  delayMs = 2000
): Promise<RankingEntry[]> {
  let html: string;
  let vs: ViewState;

  if (page === 1) {
    ({ html, viewState: vs } = await session.get(RANKING_PATH));
  } else {
    // We need the ViewState from page 1 first — caller must pass it via the session
    // For page > 1 we do a postback using the GridView pagination
    ({ html, viewState: vs } = await session.doPostBack(
      RANKING_PATH,
      "ctl00$ContentPlaceHolder1$playersGreidview",
      `Page$${page}`,
      extractViewState(html!) // will be replaced below
    ));
    void vs; // suppress unused warning
  }

  await delay(delayMs);
  return parseRankingTable(html!);
}

/** Fetch all ranking pages sequentially, maintaining ViewState continuity. */
export async function scrapeAllRankingPages(
  session: CookieSession,
  maxPages = 20,
  delayMs = 2000
): Promise<RankingEntry[]> {
  const allEntries: RankingEntry[] = [];

  // Page 1 — GET
  let { html, viewState: vs } = await session.get(RANKING_PATH);
  await delay(delayMs);
  allEntries.push(...parseRankingTable(html));

  for (let page = 2; page <= maxPages; page++) {
    try {
      ({ html, viewState: vs } = await session.doPostBack(
        RANKING_PATH,
        "ctl00$ContentPlaceHolder1$playersGreidview",
        `Page$${page}`,
        vs
      ));
      await delay(delayMs);
      const entries = parseRankingTable(html);
      if (entries.length === 0) break; // no more pages
      allEntries.push(...entries);
    } catch (err) {
      console.warn(`Ranking page ${page} failed: ${err}`);
      break;
    }
  }

  return allEntries;
}

function parseRankingTable(html: string): RankingEntry[] {
  const $ = cheerio.load(html);
  const entries: RankingEntry[] = [];

  // Target the specific GridView table by ID
  // Columns: דירוג(rank) | מספר שחקן(israeliId) | name(link) | מד כושר ישראלי | מד כושר בינלאומי
  const table = $("#ctl00_ContentPlaceHolder1_playersGreidview");
  if (!table.length) return entries;

  table.find("tr").each((rowIdx, row) => {
    if (rowIdx === 0) return; // header <th> row
    const cells = $(row).find("td");
    if (cells.length < 4) return;

    const link = $(row).find("a[href*='Player.aspx']").first();
    const href = link.attr("href") ?? "";
    const idMatch = href.match(/Id=(\d+)/i);
    if (!idMatch) return;

    const israeliId = parseInt(idMatch[1], 10);
    if (!israeliId) return;

    const rank = parseInt($(cells.get(0)!).text().trim(), 10) || rowIdx;
    const name = link.text().trim();
    // col index 3 = Israeli rating, col index 4 = FIDE rating
    const israeliRating = parseInt($(cells.get(3)!).text().trim(), 10) || 0;
    const fideRatingRaw = parseInt($(cells.get(4)!).text().trim(), 10);
    const fideRating = fideRatingRaw > 0 ? fideRatingRaw : undefined;

    if (!name || !israeliRating) return;

    entries.push({ rank, israeliId, name, israeliRating, fideRating });
  });

  return entries;
}

// ─── Player profile ──────────────────────────────────────────────────────────

const PLAYER_PATH = "/Players/Player.aspx";

export async function scrapePlayerProfile(
  session: CookieSession,
  israeliId: number
): Promise<PlayerProfile> {
  const path = `${PLAYER_PATH}?Id=${israeliId}`;
  const { html } = await session.get(path);
  return parsePlayerProfile(html, israeliId);
}

function parsePlayerProfile(html: string, israeliId: number): PlayerProfile {
  const $ = cheerio.load(html);

  // Name — in the second h2 on the page ("פרטי שחקן" is first, player name is second)
  const h2s = $("h2");
  const nameRaw = h2s.length >= 2 ? h2s.eq(1).text() : h2s.first().text();
  const name = nameRaw.replace(/\s+/g, " ").trim() || `Player ${israeliId}`;

  // FIDE ID — in anchor to ratings.fide.com/profile/NNNNNNN
  let fideId: string | undefined;
  $("a[href*='ratings.fide.com/profile/']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const m = href.match(/\/profile\/(\d+)/);
    if (m) fideId = m[1];
  });

  // Parse all <li> items once
  let israeliRating = 0;
  let expectedRating: number | undefined;
  let fideRatingStandard: number | undefined;
  let fideRatingRapid: number | undefined;
  let fideRatingBlitz: number | undefined;
  let title: string | undefined;
  let israeliTitle: string | undefined;
  let birthYear: number | undefined;
  let cardValidUntil: Date | undefined;
  let cardActive: boolean | undefined;
  let club: string | undefined;
  let israeliRank: number | undefined;

  $("li").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();

    if (text.includes("מד כושר ישראלי")) {
      // "מד כושר ישראלי: 2622 (צפוי: 2631)"
      const m = text.match(/:\s*(\d{3,4})/);
      if (m) israeliRating = parseInt(m[1], 10);
      const exp = text.match(/צפוי[^)]*?(\d{3,4})/);
      if (exp) expectedRating = parseInt(exp[1], 10);
    } else if (text.includes("FIDE סטנדרטי") || text.includes("FIDE רגיל") || (text.includes("FIDE") && text.includes("סטנדרטי"))) {
      const m = text.match(/:\s*(\d{3,4})/);
      if (m) fideRatingStandard = parseInt(m[1], 10);
    } else if (text.includes("FIDE מהיר") || text.includes("מהיר")) {
      if (text.includes("FIDE") || text.includes("מד כושר")) {
        const m = text.match(/:\s*(\d{3,4})/);
        if (m) fideRatingRapid = parseInt(m[1], 10);
      }
    } else if (text.includes("FIDE בזק") || text.includes("בזק")) {
      if (text.includes("FIDE") || text.includes("מד כושר")) {
        const m = text.match(/:\s*(\d{3,4})/);
        if (m) fideRatingBlitz = parseInt(m[1], 10);
      }
    } else if (text.includes("דרגה בינלאומית")) {
      // "דרגה בינלאומית: GM"
      const m = text.match(/:\s*(GM|IM|FM|CM|WGM|WIM|WFM|WCM)/);
      if (m) title = m[1];
    } else if (text.startsWith("דרגה:") || text.match(/^דרגה[\s:]/)) {
      // "דרגה: רב אמן בינלאומי"
      const val = text.replace(/^דרגה\s*:\s*/, "").trim();
      if (val && !val.match(/^(GM|IM|FM|CM|WGM|WIM|WFM|WCM)$/)) {
        israeliTitle = val;
      }
    } else if (text.includes("שנת לידה")) {
      const m = text.match(/(\d{4})/);
      if (m) birthYear = parseInt(m[1], 10);
    } else if (text.includes("תוקף") || text.includes("כרטיס שחמטאי")) {
      const dateM = text.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (dateM) {
        cardValidUntil = parseIsraeliDate(dateM[1]);
        cardActive = cardValidUntil ? cardValidUntil > new Date() : false;
      } else if (text.includes("לא בתוקף")) {
        cardActive = false;
      } else if (text.includes("בתוקף")) {
        cardActive = true;
      }
    } else if (text.includes("דירוג בישראל")) {
      const m = text.match(/:\s*(\d+)/);
      if (m) israeliRank = parseInt(m[1], 10);
    }
  });

  // Club — extract from <b>מועדון:</b> <a>...</a> pattern
  const clubLink = $("b").filter((_, el) => $(el).text().includes("מועדון")).first();
  if (clubLink.length) {
    club = clubLink.next("a").text().trim() || clubLink.parent().text().replace(/מועדון\s*:?\s*/g, "").trim();
  }
  if (!club) {
    $("li").each((_, el) => {
      const text = $(el).text().trim();
      if (text.startsWith("מועדון")) {
        club = text.replace(/^מועדון[^:]*:\s*/, "").replace(/\s+/g, " ").trim();
      }
    });
  }

  return {
    israeliId,
    name,
    fideId,
    birthYear,
    israeliRating,
    expectedRating,
    fideRatingStandard,
    fideRatingRapid,
    fideRatingBlitz,
    title,
    israeliTitle,
    cardValidUntil,
    cardActive,
    club,
    israeliRank,
  };
}

// ─── Player tournaments ──────────────────────────────────────────────────────

export async function scrapePlayerTournaments(
  session: CookieSession,
  israeliId: number,
  cutoffDate: Date,
  delayMs = 2000
): Promise<TournamentEntry[]> {
  const path = `${PLAYER_PATH}?Id=${israeliId}`;
  const allEntries: TournamentEntry[] = [];

  let { html, viewState: vs } = await session.get(path);
  await delay(delayMs);
  allEntries.push(...parseTournamentTable(html, cutoffDate));

  // Paginate tournament history
  let page = 2;
  while (page <= 50) {
    try {
      ({ html, viewState: vs } = await session.doPostBack(
        path,
        "ctl00$ContentPlaceHolder1$PlayerFormView$TournamentsGridView",
        `Page$${page}`,
        vs
      ));
      await delay(delayMs);
      const entries = parseTournamentTable(html, cutoffDate);
      if (entries.length === 0) break;
      // If all entries are before cutoff, stop
      const allBeforeCutoff = entries.every((e) => e.date < cutoffDate);
      allEntries.push(...entries);
      if (allBeforeCutoff) break;
      page++;
    } catch {
      break;
    }
  }

  return allEntries.filter((e) => e.date >= cutoffDate);
}

/** Sentinel names that represent pending updates, not real tournaments */
const FAKE_TOURNAMENT_NAMES = ["בעדכון הבא", "עדכון ", "התחרות לא תחושב"];

function parseTournamentTable(html: string, cutoffDate: Date): TournamentEntry[] {
  const $ = cheerio.load(html);
  const entries: TournamentEntry[] = [];

  // Target the specific GridView table
  // Columns: תאריך התחלה(0) | תאריך עדכון(1) | תחרות/link(2) | משחקים(3) | נקודות(4) | רמת ביצוע(5) | תוצאה(6) | שינוי מד כושר(7)
  const table = $("#ctl00_ContentPlaceHolder1_PlayerFormView_TournamentsGridView");
  if (!table.length) return entries;

  table.find("tr").each((rowIdx, row) => {
    if (rowIdx === 0) return; // header
    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const dateStr = $(cells.get(0)!).text().trim();
    const date = parseIsraeliDate(dateStr);
    if (!date) return;

    // Tournament name + optional link
    const tCell = $(cells.get(2)!);
    const tLink = tCell.find("a[href*='PlayerInTournament.aspx']").first();
    const tournamentName = (tLink.length ? tLink.text() : tCell.text()).trim();
    if (!tournamentName) return;

    // Skip fake "pending update" rows
    if (FAKE_TOURNAMENT_NAMES.some(f => tournamentName.startsWith(f))) return;

    // Extract Israeli tournament ID from href
    const href = tLink.attr("href") ?? "";
    const idMatch = href.match(/Id=(\d+)/i);
    const israeliTournamentId = idMatch ? parseInt(idMatch[1], 10) : undefined;

    const games = parseInt($(cells.get(3)!).text().trim(), 10) || 0;
    const points = parseFloat($(cells.get(4)!).text().trim()) || 0;
    const performanceRating = parseNum($(cells.get(5)!).text().trim());
    const result = $(cells.get(6)!).text().trim();
    const ratingChangeStr = $(cells.get(7)!).text().trim().replace(/[^\d\-+]/g, "");
    const ratingChange = ratingChangeStr ? parseInt(ratingChangeStr, 10) || undefined : undefined;

    entries.push({
      date,
      tournamentName: tournamentName.slice(0, 255),
      israeliTournamentId,
      games,
      points,
      performanceRating,
      result: result || `${points}/${games}`,
      ratingChange,
    });
  });

  return entries;
}

// ─── Player rating history ───────────────────────────────────────────────────

export async function scrapePlayerRatingHistory(
  session: CookieSession,
  israeliId: number,
  delayMs = 2000
): Promise<RatingEntry[]> {
  const path = `${PLAYER_PATH}?Id=${israeliId}`;

  // First load the player page
  let { html, viewState: vs } = await session.get(path);
  await delay(delayMs);

  // Click the rating history tab
  ({ html, viewState: vs } = await session.doPostBack(
    path,
    "ctl00$ContentPlaceHolder1$PlayerFormView$ShowRatingButton",
    "",
    vs
  ));
  await delay(delayMs);

  return parseRatingHistoryTable(html);
}

function parseRatingHistoryTable(html: string): RatingEntry[] {
  const $ = cheerio.load(html);
  const entries: RatingEntry[] = [];

  // Rating data is encoded in image map <area> tags:
  // <area title="31/01/2026 1779" alt="31/01/2026 1779" />
  $("area[title]").each((_, el) => {
    const title = $(el).attr("title") ?? "";
    // Format: "DD/MM/YYYY NNNN"
    const m = title.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{3,4})/);
    if (!m) return;
    const date = parseIsraeliDate(m[1]);
    const rating = parseInt(m[2], 10);
    if (!date || !rating || rating < 100 || rating > 3500) return;
    const period = m[1]; // keep original date string as period label
    entries.push({ period, rating, recordedAt: date });
  });

  // Deduplicate by period (keep last seen)
  const seen = new Map<string, RatingEntry>();
  for (const e of entries) seen.set(e.period, e);

  return Array.from(seen.values()).sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
  );
}

function parsePeriodToDate(period: string): Date | undefined {
  // ISO format: "2024-01"
  const isoMatch = period.match(/(\d{4})-(\d{2})/);
  if (isoMatch) return new Date(`${isoMatch[1]}-${isoMatch[2]}-01`);

  // Hebrew month names
  const hebrewMonths: Record<string, string> = {
    ינואר: "01", פברואר: "02", מרץ: "03", אפריל: "04",
    מאי: "05", יוני: "06", יולי: "07", אוגוסט: "08",
    ספטמבר: "09", אוקטובר: "10", נובמבר: "11", דצמבר: "12",
  };
  for (const [heb, num] of Object.entries(hebrewMonths)) {
    if (period.includes(heb)) {
      const yearMatch = period.match(/\d{4}/);
      if (yearMatch) return new Date(`${yearMatch[0]}-${num}-01`);
    }
  }

  return undefined;
}

// ─── Player games (optional) ─────────────────────────────────────────────────

export async function scrapePlayerGames(
  session: CookieSession,
  israeliId: number,
  cutoffDate: Date,
  delayMs = 2000
): Promise<GameEntry[]> {
  const path = `${PLAYER_PATH}?Id=${israeliId}`;

  let { html, viewState: vs } = await session.get(path);
  await delay(delayMs);

  // Click the games tab via ShowGamesButton postback
  ({ html, viewState: vs } = await session.doPostBack(
    path,
    "ctl00$ContentPlaceHolder1$PlayerFormView$ShowGamesButton",
    "",
    vs
  ));
  await delay(delayMs);

  const allGames: GameEntry[] = [];
  allGames.push(...parseGamesTable(html, israeliId, cutoffDate));

  // Paginate (correct grid view name: PLayerGamesGridView)
  let page = 2;
  while (page <= 100) {
    try {
      ({ html, viewState: vs } = await session.doPostBack(
        path,
        "ctl00$ContentPlaceHolder1$PlayerFormView$PLayerGamesGridView",
        `Page$${page}`,
        vs
      ));
      await delay(delayMs);
      const games = parseGamesTable(html, israeliId, cutoffDate);
      if (games.length === 0) break;
      const allBeforeCutoff = games.every((g) => g.date < cutoffDate);
      allGames.push(...games);
      if (allBeforeCutoff) break;
      page++;
    } catch {
      break;
    }
  }

  // Assign round numbers per tournament (sequential within each israeliTournamentId)
  const roundCounters = new Map<string, number>();
  for (const game of allGames) {
    const key = game.israeliTournamentId
      ? `t${game.israeliTournamentId}`
      : `n${game.tournamentName}`;
    const n = (roundCounters.get(key) ?? 0) + 1;
    roundCounters.set(key, n);
    game.round = n;
  }

  return allGames.filter((g) => g.date >= cutoffDate);
}

function parseGamesTable(html: string, israeliId: number, cutoffDate: Date): GameEntry[] {
  // Table id: ctl00_ContentPlaceHolder1_PlayerFormView_PLayerGamesGridView
  // Columns: tournament(0) | date(1) | ratingUpdate(2) | whitePlayer(3) | whiteScore(4) | "-"(5) | blackScore(6) | blackPlayer(7)
  const $ = cheerio.load(html);
  const games: GameEntry[] = [];

  const table = $("#ctl00_ContentPlaceHolder1_PlayerFormView_PLayerGamesGridView");
  if (!table.length) return games;

  table.find("tbody tr, tr").each((rowIdx, row) => {
    const cells = $(row).find("td");
    if (cells.length < 7) return;

    // Tournament
    const tCell = $(cells.get(0)!);
    const tLink = tCell.find("a").first();
    const tournamentName = tLink.text().trim() || tCell.text().trim();
    const tHref = tLink.attr("href") ?? "";
    const tIdMatch = tHref.match(/Id=(\d+)/i);
    const israeliTournamentId = tIdMatch ? parseInt(tIdMatch[1], 10) : undefined;

    // Date
    const dateStr = $(cells.get(1)!).text().trim();
    const date = parseIsraeliDate(dateStr);
    if (!date || date < cutoffDate) return;

    // White player link — href contains "Player.aspx?Id=XXXXXX"
    const whiteCell = $(cells.get(3)!);
    const whiteLink = whiteCell.find("a").first();
    const whiteHref = whiteLink.attr("href") ?? "";
    const whiteIdMatch = whiteHref.match(/Id=(\d+)/i);
    const whiteIsraeliId = whiteIdMatch ? parseInt(whiteIdMatch[1], 10) : undefined;
    const whiteText = whiteLink.text().trim(); // "שם שחקן (1779)"

    // Black player link
    const blackCell = $(cells.get(7)!);
    const blackLink = blackCell.find("a").first();
    const blackHref = blackLink.attr("href") ?? "";
    const blackIdMatch = blackHref.match(/Id=(\d+)/i);
    const blackIsraeliId = blackIdMatch ? parseInt(blackIdMatch[1], 10) : undefined;
    const blackText = blackLink.text().trim();

    // Determine our player's color
    const isWhite = whiteIsraeliId === israeliId;
    const isBlack = blackIsraeliId === israeliId;
    if (!isWhite && !isBlack) return; // shouldn't happen

    const color: "white" | "black" = isWhite ? "white" : "black";

    // Extract opponent name and rating from text like "שם (1779)"
    const opponentText = isWhite ? blackText : whiteText;
    const opponentIsraeliId = isWhite ? blackIsraeliId : whiteIsraeliId;
    const ratingMatch = opponentText.match(/\((\d{3,4})\)/);
    const opponentRating = ratingMatch ? parseInt(ratingMatch[1], 10) : undefined;
    const opponentName = opponentText.replace(/\s*\(\d+\)\s*$/, "").trim();
    if (!opponentName) return;

    // Scores
    const whiteScore = parseFloat($(cells.get(4)!).text().trim()) || 0;
    const blackScore = parseFloat($(cells.get(6)!).text().trim()) || 0;
    const myScore = isWhite ? whiteScore : blackScore;

    let result: "win" | "loss" | "draw";
    if (myScore === 1) result = "win";
    else if (myScore === 0) result = "loss";
    else result = "draw";

    games.push({
      date,
      tournamentName: tournamentName.slice(0, 255),
      israeliTournamentId,
      opponentName,
      opponentIsraeliId,
      opponentRating,
      color,
      result,
    });
  });

  return games;
}

// ─── Search players (bulk) ────────────────────────────────────────────────────

const SEARCH_PATH = "/Players/SearchPlayers.aspx";

export async function scrapeSearchPlayers(
  session: CookieSession,
  filters: { activeCardOnly?: boolean; activeOnly?: boolean },
  delayMs = 2000
): Promise<SearchPlayerEntry[]> {
  // The search page caps at 250 results with no pagination.
  // Strategy: split by rating ranges to keep each batch under 250.
  // We use adaptive splitting — if a range returns 250 (= capped), subdivide it.
  const allEntries: SearchPlayerEntry[] = [];
  const seen = new Set<number>();

  async function fetchRange(minRating: number, maxRating: number): Promise<void> {
    const entries = await searchWithRatingRange(session, filters, minRating, maxRating, delayMs);
    const label = maxRating < 9999 ? `${minRating}-${maxRating}` : `${minRating}+`;
    console.log(`  Rating ${label}: ${entries.length} players`);

    if (entries.length >= 250 && maxRating - minRating > 50) {
      // Capped — subdivide this range
      const mid = Math.floor((minRating + maxRating) / 2);
      console.log(`  → Splitting ${label} into ${minRating}-${mid} and ${mid + 1}-${maxRating}`);
      await fetchRange(minRating, mid);
      await fetchRange(mid + 1, maxRating);
      return;
    }

    for (const e of entries) {
      if (!seen.has(e.israeliId)) {
        seen.add(e.israeliId);
        allEntries.push(e);
      }
    }
  }

  // Start with broad rating ranges
  const ranges: [number, number][] = [
    [0, 1399],
    [1400, 1599],
    [1600, 1799],
    [1800, 1999],
    [2000, 9999],
  ];

  for (const [min, max] of ranges) {
    await fetchRange(min, max);
  }

  return allEntries;
}

async function searchWithRatingRange(
  session: CookieSession,
  filters: { activeCardOnly?: boolean; activeOnly?: boolean },
  minRating: number,
  maxRating: number,
  delayMs: number
): Promise<SearchPlayerEntry[]> {
  // Each search needs a fresh session state (GET → advanced → submit)
  let { html, viewState: vs } = await session.get(SEARCH_PATH);
  await delay(delayMs);

  ({ html, viewState: vs } = await session.doPostBack(
    SEARCH_PATH,
    "ctl00$ContentPlaceHolder1$AdvancedSearchLinkButton",
    "",
    vs
  ));
  await delay(delayMs);

  const extraFields: Record<string, string> = {
    "ctl00$ContentPlaceHolder1$AdvancedSearchButton": "חיפוש",
    "ctl00$ContentPlaceHolder1$RatingFromTB": String(minRating),
  };
  // Only set max rating if not "unbounded"
  if (maxRating < 9999) {
    extraFields["ctl00$ContentPlaceHolder1$RatingUptoTB"] = String(maxRating);
  }
  if (filters.activeCardOnly) {
    extraFields["ctl00$ContentPlaceHolder1$MembershipStatusDDL"] = "בתוקף";
  }
  if (filters.activeOnly) {
    extraFields["ctl00$ContentPlaceHolder1$PlayerStatusDDL"] = "1";
  }

  ({ html, viewState: vs } = await session.doPostBack(
    SEARCH_PATH,
    "ctl00$ContentPlaceHolder1$AdvancedSearchButton",
    "",
    vs,
    extraFields
  ));
  await delay(delayMs);

  return parseSearchResultsTable(html);
}

function parseSearchResultsTable(html: string): SearchPlayerEntry[] {
  const $ = cheerio.load(html);
  const entries: SearchPlayerEntry[] = [];

  // Find the results GridView table
  const table = $("table[id*='GridView']").first();
  if (!table.length) return entries;

  // Columns (15): #(0) | name(1) | israeliId(2) | country(3) | gender(4) |
  // tournamentCount(5) | club(6) | fideId(7) | status(8) | israeliRating(9) |
  // fideRating(10) | title(11) | cardValidity(12) | birthYear(13) | role(14)
  table.find("tr").each((rowIdx, row) => {
    if (rowIdx === 0) return; // header
    const cells = $(row).find("td");
    if (cells.length < 10) return; // skip pager rows

    const getText = (idx: number) => $(cells.get(idx)!).text().trim();

    const israeliId = parseNum(getText(2));
    if (!israeliId) return;

    const name = getText(1);
    if (!name) return;

    const israeliRating = parseNum(getText(9)) ?? 0;

    const entry: SearchPlayerEntry = {
      israeliId,
      name,
      country: getText(3),
      gender: getText(4),
      tournamentCount: parseNum(getText(5)) ?? 0,
      club: getText(6),
      status: getText(8),
      israeliRating,
    };

    const fideIdRaw = getText(7);
    if (fideIdRaw && fideIdRaw !== "0") entry.fideId = fideIdRaw;

    const fideRating = parseNum(getText(10));
    if (fideRating && fideRating > 0) entry.fideRating = fideRating;

    const title = getText(11);
    if (title) entry.title = title;

    const cardValidity = getText(12);
    if (cardValidity) entry.cardValidUntil = cardValidity;

    const birthYear = parseNum(getText(13));
    if (birthYear && birthYear > 1900 && birthYear < 2025) entry.birthYear = birthYear;

    entries.push(entry);
  });

  return entries;
}

// ─── Rate limit detection ─────────────────────────────────────────────────────

export async function detectOptimalDelay(session: CookieSession): Promise<number> {
  const candidates = [500, 750, 1000, 1500, 2000];
  for (const candidateDelay of candidates) {
    let allSucceeded = true;
    const latencies: number[] = [];
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      try {
        await session.get(RANKING_PATH);
        latencies.push(Date.now() - start);
        await delay(candidateDelay);
      } catch {
        allSucceeded = false;
        break;
      }
    }
    if (allSucceeded) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      if (avg < candidateDelay * 0.9) {
        console.log(`✓ Detected safe delay: ${candidateDelay}ms (avg response: ${Math.round(avg)}ms)`);
        return candidateDelay;
      }
    }
  }
  console.log("Using conservative fallback delay: 2000ms");
  return 2000;
}
