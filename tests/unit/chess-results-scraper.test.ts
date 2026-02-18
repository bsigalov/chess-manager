import * as fs from "fs";
import * as path from "path";

// Mock fetchPage and delay before importing the module under test
jest.mock("@/lib/scrapers/chess-results-parser", () => {
  const actual = jest.requireActual("@/lib/scrapers/chess-results-parser");
  return {
    ...actual,
    fetchPage: jest.fn(),
    delay: jest.fn().mockResolvedValue(undefined),
  };
});

import { fetchPage } from "@/lib/scrapers/chess-results-parser";
import {
  parseChessResultsTable,
  parseResult,
  parseTitle,
  parseRating,
  parseCrosstableCell,
} from "@/lib/scrapers/chess-results-parser";
import {
  parseTournamentUrl,
  parseBaseUrl,
  scrapePlayerList,
  scrapeStandings,
  scrapePairings,
  scrapeTournamentInfo,
  scrapeCrosstable,
} from "@/lib/scrapers/chess-results";

const mockedFetchPage = fetchPage as jest.MockedFunction<typeof fetchPage>;

const fixturesDir = path.join(__dirname, "..", "fixtures");
const playerListHtml = fs.readFileSync(
  path.join(fixturesDir, "playerlist-art0.html"),
  "utf-8"
);
const standingsHtml = fs.readFileSync(
  path.join(fixturesDir, "standings-art1.html"),
  "utf-8"
);
const pairingsHtml = fs.readFileSync(
  path.join(fixturesDir, "pairings-art2-rd1.html"),
  "utf-8"
);
const tournamentInfoHtml = fs.readFileSync(
  path.join(fixturesDir, "tournament-info.html"),
  "utf-8"
);
const crosstableHtml = fs.readFileSync(
  path.join(fixturesDir, "crosstable-art4.html"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// 1. parseChessResultsTable
// ---------------------------------------------------------------------------
describe("parseChessResultsTable", () => {
  it("extracts rows from a chess-results HTML table", () => {
    const rows = parseChessResultsTable(playerListHtml);
    // Header row + 72 data rows
    expect(rows.length).toBeGreaterThan(40);
    // First data row (after header) should start with "1"
    expect(rows[1][0]).toBe("1");
  });

  it("returns empty array for HTML with no matching table", () => {
    const rows = parseChessResultsTable("<html><body>No table</body></html>");
    expect(rows).toEqual([]);
  });

  it("header row contains expected column names", () => {
    const rows = parseChessResultsTable(playerListHtml);
    const header = rows[0];
    expect(header).toContain("No.");
    expect(header).toContain("Name");
    expect(header).toContain("FED");
    expect(header).toContain("Rtg");
  });
});

// ---------------------------------------------------------------------------
// 2. scrapePlayerList
// ---------------------------------------------------------------------------
describe("scrapePlayerList", () => {
  beforeEach(() => {
    mockedFetchPage.mockResolvedValue(playerListHtml);
  });

  it("parses all players from the fixture", async () => {
    const players = await scrapePlayerList("1233866");
    expect(players.length).toBe(72);
  });

  it("parses player 1 (titled IM) correctly", async () => {
    const players = await scrapePlayerList("1233866");
    const p = players[0];
    expect(p.startingRank).toBe(1);
    expect(p.name).toBe("Mindlin, Alon");
    expect(p.title).toBe("IM");
    expect(p.rating).toBe(2472);
    expect(p.federation).toBe("ISR");
    expect(p.fideId).toBe("2800071");
  });

  it("parses player 2 (titled IM) correctly", async () => {
    const players = await scrapePlayerList("1233866");
    const p = players[1];
    expect(p.startingRank).toBe(2);
    expect(p.name).toBe("Veinberg, Nimrod");
    expect(p.title).toBe("IM");
    expect(p.rating).toBe(2452);
    expect(p.federation).toBe("ISR");
  });

  it("parses player 7 (titled FM) correctly", async () => {
    const players = await scrapePlayerList("1233866");
    const p = players[6]; // 0-indexed
    expect(p.startingRank).toBe(7);
    expect(p.name).toBe("Guz, Ari");
    expect(p.title).toBe("FM");
    expect(p.rating).toBe(2380);
    expect(p.federation).toBe("ISR");
  });

  it("parses untitled players correctly", async () => {
    const players = await scrapePlayerList("1233866");
    // Player 9: Barak, Gil (no title)
    const p = players[8];
    expect(p.startingRank).toBe(9);
    expect(p.name).toBe("Barak, Gil");
    expect(p.title).toBeNull();
    expect(p.rating).toBe(2275);
    expect(p.federation).toBe("ISR");
  });

  it("handles non-ISR federation", async () => {
    const players = await scrapePlayerList("1233866");
    // Player 5: GM Dvoirys, Semen I. — RUS federation
    const gm = players[4];
    expect(gm.name).toBe("Dvoirys, Semen I.");
    expect(gm.title).toBe("GM");
    expect(gm.federation).toBe("RUS");

    // Player 31: Segal, Naum — LAT federation
    const lat = players[30];
    expect(lat.name).toBe("Segal, Naum");
    expect(lat.federation).toBe("LAT");
  });

  it("returns null rating for players with 0 rating", async () => {
    const players = await scrapePlayerList("1233866");
    // Player 70: Brickner, Aner — rating 0 in HTML
    const p = players[69];
    expect(p.name).toBe("Brickner, Aner");
    expect(p.rating).toBeNull();
  });

  it("parses WIM and WFM titles", async () => {
    const players = await scrapePlayerList("1233866");
    // Player 12: WIM Orian, Noga
    expect(players[11].title).toBe("WIM");
    // Player 25: WFM Reprun, Nadejda
    expect(players[24].title).toBe("WFM");
  });
});

// ---------------------------------------------------------------------------
// 3. scrapeStandings
// ---------------------------------------------------------------------------
describe("scrapeStandings", () => {
  beforeEach(() => {
    mockedFetchPage.mockResolvedValue(standingsHtml);
  });

  it("parses all standings entries", async () => {
    const standings = await scrapeStandings("1233866");
    expect(standings.length).toBe(72);
  });

  it("parses rank 1 correctly", async () => {
    const standings = await scrapeStandings("1233866");
    const s = standings[0];
    expect(s.rank).toBe(1);
    expect(s.name).toBe("Mindlin, Alon");
    expect(s.rating).toBe(2472);
    expect(s.points).toBe(7.5);
    expect(s.gamesPlayed).toBe(9);
  });

  it("parses rank 2 correctly", async () => {
    const standings = await scrapeStandings("1233866");
    const s = standings[1];
    expect(s.rank).toBe(2);
    expect(s.name).toBe("Guz, Ari");
    expect(s.rating).toBe(2380);
    expect(s.points).toBe(7.5);
  });

  it("has tiebreak values as numbers", async () => {
    const standings = await scrapeStandings("1233866");
    const s = standings[0];
    expect(typeof s.tiebreak1).toBe("number");
    expect(typeof s.tiebreak2).toBe("number");
    expect(s.tiebreak1).toBe(50.5);
    expect(s.tiebreak2).toBe(54);
  });

  it("converts comma-decimal points to numbers", async () => {
    const standings = await scrapeStandings("1233866");
    // "7,5" -> 7.5
    expect(standings[0].points).toBe(7.5);
    // "6,5" -> 6.5
    expect(standings[2].points).toBe(6.5);
    // "6" -> 6
    expect(standings[10].points).toBe(6);
  });

  it("skips Club/City column with Hebrew text", async () => {
    const standings = await scrapeStandings("1233866");
    // If Club/City were misinterpreted, points/tiebreaks would be wrong
    // Verify several entries have correct points
    expect(standings[0].points).toBe(7.5);
    expect(standings[10].points).toBe(6);
    expect(standings[15].points).toBe(5.5);
  });

  it("extracts gamesPlayed from round count in heading", async () => {
    const standings = await scrapeStandings("1233866");
    // All entries should have gamesPlayed = 9 from "Final Ranking after 9 Rounds"
    for (const entry of standings) {
      expect(entry.gamesPlayed).toBe(9);
    }
  });

  it("handles players with 0 rating", async () => {
    const standings = await scrapeStandings("1233866");
    // Finkelstein, Alex — rating 0 in HTML
    const alex = standings.find((s) => s.name === "Finkelstein, Alex");
    expect(alex).toBeDefined();
    expect(alex!.rating).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. scrapePairings
// ---------------------------------------------------------------------------
describe("scrapePairings", () => {
  beforeEach(() => {
    mockedFetchPage.mockResolvedValue(pairingsHtml);
  });

  it("parses all pairings for round 1", async () => {
    const pairings = await scrapePairings("1233866", 1);
    expect(pairings.length).toBe(36);
  });

  it("parses board 1 correctly", async () => {
    const pairings = await scrapePairings("1233866", 1);
    const p = pairings[0];
    expect(p.board).toBe(1);
    expect(p.whiteName).toBe("Segal, Yosef");
    expect(p.blackName).toBe("Mindlin, Alon");
    expect(p.whiteRating).toBe(1867);
    expect(p.blackRating).toBe(2472);
    expect(p.result).toBe("0-1");
  });

  it("parses board 2 correctly", async () => {
    const pairings = await scrapePairings("1233866", 1);
    const p = pairings[1];
    expect(p.board).toBe(2);
    expect(p.whiteName).toBe("Veinberg, Nimrod");
    expect(p.blackName).toBe("Piakarchyk, Artsemi");
    expect(p.whiteRating).toBe(2452);
    expect(p.blackRating).toBe(1859);
    expect(p.result).toBe("1-0");
  });

  it("parses draw result as 1/2-1/2", async () => {
    const pairings = await scrapePairings("1233866", 1);
    // Board 13: Drubin, Emanuel vs Kaganskiy, Gleb — draw
    const draw = pairings[12];
    expect(draw.board).toBe(13);
    expect(draw.result).toBe("1/2-1/2");
    expect(draw.whiteName).toBe("Drubin, Emanuel");
    expect(draw.blackName).toBe("Kaganskiy, Gleb");
  });

  it("extracts ratings as integers", async () => {
    const pairings = await scrapePairings("1233866", 1);
    for (const p of pairings) {
      if (p.whiteRating !== null) {
        expect(Number.isInteger(p.whiteRating)).toBe(true);
      }
      if (p.blackRating !== null) {
        expect(Number.isInteger(p.blackRating)).toBe(true);
      }
    }
  });

  it("does not confuse starting numbers with ratings", async () => {
    const pairings = await scrapePairings("1233866", 1);
    // Board 1: white No.=37 (starting number), rating should be 1867 not 37
    expect(pairings[0].whiteRating).toBe(1867);
    // Board 2: white No.=2, rating should be 2452
    expect(pairings[1].whiteRating).toBe(2452);
    // Board 9: white No.=45, rating should be 1664
    expect(pairings[8].whiteRating).toBe(1664);
  });

  it("handles titled black players", async () => {
    const pairings = await scrapePairings("1233866", 1);
    // Board 1: black is IM Mindlin
    expect(pairings[0].blackName).toBe("Mindlin, Alon");
    expect(pairings[0].blackRating).toBe(2472);
    // Board 7: black is FM Guz, Ari
    expect(pairings[6].blackName).toBe("Guz, Ari");
    expect(pairings[6].blackRating).toBe(2380);
  });

  it("handles untitled white players", async () => {
    const pairings = await scrapePairings("1233866", 1);
    // Board 1: white has no title (empty cell)
    expect(pairings[0].whiteName).toBe("Segal, Yosef");
    // Board 9: white has no title
    expect(pairings[8].whiteName).toBe("Goralskiy, Rey");
  });

  it("handles players with 0 rating", async () => {
    const pairings = await scrapePairings("1233866", 1);
    // Board 34: Lapushnian, Maya (1917) vs Brickner, Aner (0)
    const p34 = pairings[33];
    expect(p34.whiteName).toBe("Lapushnian, Maya");
    expect(p34.whiteRating).toBe(1917);
    expect(p34.blackName).toBe("Brickner, Aner");
    // Rating 0 -> parseRating returns null (< 100)
    expect(p34.blackRating).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. scrapeTournamentInfo
// ---------------------------------------------------------------------------
describe("scrapeTournamentInfo", () => {
  beforeEach(() => {
    mockedFetchPage.mockResolvedValue(tournamentInfoHtml);
  });

  it("parses tournament name", async () => {
    const info = await scrapeTournamentInfo("1233866");
    expect(info.name).toBe("Rishon LeZion Summer Festival Blitz");
  });

  it("returns 0 rounds from the info page (no round text present)", async () => {
    // The info page HTML does NOT contain "X Rounds" or "Round X" text
    // This documents the known limitation of the info page
    const info = await scrapeTournamentInfo("1233866");
    expect(info.rounds).toBe(0);
    expect(info.currentRound).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Pure utility functions
// ---------------------------------------------------------------------------
describe("parseTournamentUrl", () => {
  it("extracts ID from a standard URL", () => {
    expect(
      parseTournamentUrl(
        "https://chess-results.com/tnr1233866.aspx?lan=1&art=0"
      )
    ).toBe("1233866");
  });

  it("extracts ID from URL with subdomain", () => {
    expect(
      parseTournamentUrl(
        "https://s2.chess-results.com/tnr999999.aspx?lan=1"
      )
    ).toBe("999999");
  });

  it("extracts ID from minimal URL", () => {
    expect(parseTournamentUrl("tnr123456")).toBe("123456");
  });

  it("throws for invalid URL", () => {
    expect(() => parseTournamentUrl("https://chess-results.com/")).toThrow(
      "Invalid chess-results.com URL"
    );
  });

  it("throws for URL without tnr pattern", () => {
    expect(() => parseTournamentUrl("no-id-here")).toThrow();
  });
});

describe("parseBaseUrl", () => {
  it("extracts base URL from standard chess-results URL", () => {
    expect(
      parseBaseUrl("https://chess-results.com/tnr1233866.aspx?lan=1")
    ).toBe("https://chess-results.com");
  });

  it("extracts base URL with subdomain", () => {
    expect(
      parseBaseUrl("https://s2.chess-results.com/tnr999.aspx")
    ).toBe("https://s2.chess-results.com");
  });

  it("handles different subdomains", () => {
    expect(
      parseBaseUrl("https://s8.chess-results.com/tnr123.aspx")
    ).toBe("https://s8.chess-results.com");
  });

  it("returns default URL for invalid input", () => {
    expect(parseBaseUrl("not-a-url")).toBe("https://chess-results.com");
  });
});

// ---------------------------------------------------------------------------
// 7. parseCrosstableCell
// ---------------------------------------------------------------------------
describe("parseCrosstableCell", () => {
  it("parses standard win as white: '56b1'", () => {
    const r = parseCrosstableCell("56b1", 1);
    expect(r.opponentRank).toBe(56);
    expect(r.color).toBe("b");
    expect(r.score).toBe(1);
    expect(r.isBye).toBe(false);
    expect(r.isForfeit).toBe(false);
  });

  it("parses draw as black: '30w½'", () => {
    const r = parseCrosstableCell("30w\u00bd", 2);
    expect(r.opponentRank).toBe(30);
    expect(r.color).toBe("w");
    expect(r.score).toBe(0.5);
  });

  it("parses loss: '4b0'", () => {
    const r = parseCrosstableCell("4b0", 5);
    expect(r.opponentRank).toBe(4);
    expect(r.color).toBe("b");
    expect(r.score).toBe(0);
  });

  it("parses BYE", () => {
    const r = parseCrosstableCell("BYE", 3);
    expect(r.opponentRank).toBeNull();
    expect(r.isBye).toBe(true);
    expect(r.score).toBe(1);
  });

  it("parses empty cell as bye", () => {
    const r = parseCrosstableCell("", 1);
    expect(r.isBye).toBe(true);
    expect(r.score).toBe(0);
  });

  it("parses forfeit win: '+'", () => {
    const r = parseCrosstableCell("+", 4);
    expect(r.score).toBe(1);
    expect(r.isForfeit).toBe(true);
  });

  it("parses forfeit loss: '-'", () => {
    const r = parseCrosstableCell("-", 4);
    expect(r.score).toBe(0);
    expect(r.isForfeit).toBe(true);
  });

  it("parses '+:-' forfeit", () => {
    const r = parseCrosstableCell("+:-", 2);
    expect(r.score).toBe(1);
    expect(r.isForfeit).toBe(true);
  });

  it("sets round correctly", () => {
    const r = parseCrosstableCell("13w1", 7);
    expect(r.round).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// 8. scrapeCrosstable
// ---------------------------------------------------------------------------
describe("scrapeCrosstable", () => {
  beforeEach(() => {
    mockedFetchPage.mockResolvedValue(crosstableHtml);
  });

  it("extracts 72 players", async () => {
    const ct = await scrapeCrosstable("1233866");
    expect(ct.length).toBe(72);
  });

  it("extracts 9 rounds per player", async () => {
    const ct = await scrapeCrosstable("1233866");
    for (const entry of ct) {
      expect(entry.roundResults.length).toBe(9);
    }
  });

  it("parses Mindlin (rank 1) correctly", async () => {
    const ct = await scrapeCrosstable("1233866");
    const mindlin = ct.find((e) => e.startingRank === 1);
    expect(mindlin).toBeDefined();
    expect(mindlin!.name).toContain("Mindlin");
    expect(mindlin!.title).toBe("IM");
    expect(mindlin!.rating).toBe(2472);
    expect(mindlin!.points).toBe(7.5);
  });

  it("parses Mindlin round 1 correctly (56b1)", async () => {
    const ct = await scrapeCrosstable("1233866");
    const mindlin = ct.find((e) => e.startingRank === 1)!;
    const rd1 = mindlin.roundResults[0];
    expect(rd1.round).toBe(1);
    expect(rd1.opponentRank).toBe(56);
    expect(rd1.color).toBe("b");
    expect(rd1.score).toBe(1);
  });

  it("parses draw result correctly (Mindlin rd9: 2b½)", async () => {
    const ct = await scrapeCrosstable("1233866");
    const mindlin = ct.find((e) => e.startingRank === 1)!;
    const rd9 = mindlin.roundResults[8];
    expect(rd9.opponentRank).toBe(2);
    expect(rd9.color).toBe("b");
    expect(rd9.score).toBe(0.5);
  });

  it("parses player with no title", async () => {
    const ct = await scrapeCrosstable("1233866");
    // Rank 5 or higher should have untitled players
    const untitled = ct.find((e) => e.title === null);
    expect(untitled).toBeDefined();
    expect(untitled!.name.length).toBeGreaterThan(0);
  });

  it("total points match sum of round scores", async () => {
    const ct = await scrapeCrosstable("1233866");
    for (const entry of ct.slice(0, 10)) {
      const sum = entry.roundResults.reduce((acc, r) => acc + r.score, 0);
      expect(sum).toBeCloseTo(entry.points, 1);
    }
  });

  it("parses Guz (rank 2) loss in round 2", async () => {
    const ct = await scrapeCrosstable("1233866");
    const guz = ct.find((e) => e.startingRank === 2);
    expect(guz).toBeDefined();
    expect(guz!.name).toContain("Guz");
    // Round 2: "22w0" — played rank 22 as white, lost
    const rd2 = guz!.roundResults[1];
    expect(rd2.opponentRank).toBe(22);
    expect(rd2.color).toBe("w");
    expect(rd2.score).toBe(0);
  });
});

describe("parseResult", () => {
  it("parses '1 - 0' as '1-0'", () => {
    expect(parseResult("1 - 0")).toBe("1-0");
  });

  it("parses '0 - 1' as '0-1'", () => {
    expect(parseResult("0 - 1")).toBe("0-1");
  });

  it("parses half-character draw as '1/2-1/2'", () => {
    expect(parseResult("\u00bd - \u00bd")).toBe("1/2-1/2");
  });

  it("parses '+:-' as '1-0'", () => {
    expect(parseResult("+:-")).toBe("1-0");
  });

  it("parses '-:+' as '0-1'", () => {
    expect(parseResult("-:+")).toBe("0-1");
  });

  it("parses '+' as '1-0'", () => {
    expect(parseResult("+")).toBe("1-0");
  });

  it("parses '-' as '0-1'", () => {
    expect(parseResult("-")).toBe("0-1");
  });

  it("returns null for empty string", () => {
    expect(parseResult("")).toBeNull();
  });

  it("returns null for null-ish input", () => {
    expect(parseResult("")).toBeNull();
  });
});

describe("parseTitle", () => {
  it("detects GM", () => expect(parseTitle("GM")).toBe("GM"));
  it("detects IM", () => expect(parseTitle("IM")).toBe("IM"));
  it("detects FM", () => expect(parseTitle("FM")).toBe("FM"));
  it("detects CM", () => expect(parseTitle("CM")).toBe("CM"));
  it("detects WGM", () => expect(parseTitle("WGM")).toBe("WGM"));
  it("detects WIM", () => expect(parseTitle("WIM")).toBe("WIM"));
  it("detects WFM", () => expect(parseTitle("WFM")).toBe("WFM"));
  it("detects WCM", () => expect(parseTitle("WCM")).toBe("WCM"));
  it("detects NM", () => expect(parseTitle("NM")).toBe("NM"));

  it("returns null for empty string", () => {
    expect(parseTitle("")).toBeNull();
  });

  it("returns null for non-title text", () => {
    expect(parseTitle("Smith, John")).toBeNull();
  });

  it("handles title with trailing space prefix", () => {
    expect(parseTitle("  IM  ")).toBe("IM");
  });
});

describe("parseRating", () => {
  it("parses valid rating", () => {
    expect(parseRating("2472")).toBe(2472);
  });

  it("parses rating at lower bound", () => {
    expect(parseRating("100")).toBe(100);
  });

  it("returns null for rating below 100", () => {
    expect(parseRating("99")).toBeNull();
    expect(parseRating("0")).toBeNull();
  });

  it("returns null for rating above 3500", () => {
    expect(parseRating("3501")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseRating("abc")).toBeNull();
    expect(parseRating("")).toBeNull();
  });

  it("handles whitespace", () => {
    expect(parseRating("  2200  ")).toBe(2200);
  });
});
