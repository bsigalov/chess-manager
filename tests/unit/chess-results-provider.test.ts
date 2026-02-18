import * as fs from "fs";
import * as path from "path";

// Mock the scraper module
jest.mock("@/lib/scrapers/chess-results-parser", () => {
  const actual = jest.requireActual("@/lib/scrapers/chess-results-parser");
  return {
    ...actual,
    fetchPage: jest.fn(),
    delay: jest.fn().mockResolvedValue(undefined),
  };
});

import { fetchPage } from "@/lib/scrapers/chess-results-parser";
import { ChessResultsProvider } from "@/lib/providers/chess-results-provider";

const mockedFetchPage = fetchPage as jest.MockedFunction<typeof fetchPage>;

const fixturesDir = path.join(__dirname, "..", "fixtures");
const tournamentInfoHtml = fs.readFileSync(
  path.join(fixturesDir, "tournament-info.html"),
  "utf-8"
);
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

describe("ChessResultsProvider", () => {
  const provider = new ChessResultsProvider();

  describe("canHandle", () => {
    it("handles chess-results sourceType", () => {
      expect(provider.canHandle({ sourceType: "chess-results" })).toBe(true);
    });

    it("handles chess-results.com URLs", () => {
      expect(
        provider.canHandle({
          sourceType: "chess-results",
          url: "https://s2.chess-results.com/tnr1233866.aspx",
        })
      ).toBe(true);
    });

    it("does not handle other source types", () => {
      expect(provider.canHandle({ sourceType: "lichess" })).toBe(false);
    });
  });

  describe("fetchTournament", () => {
    beforeEach(() => {
      // Return different HTML based on the URL parameters
      mockedFetchPage.mockImplementation(async (url: string) => {
        if (url.includes("art=0")) return playerListHtml;
        if (url.includes("art=1")) return standingsHtml;
        if (url.includes("art=2")) return pairingsHtml;
        return tournamentInfoHtml; // default: info page
      });
    });

    it("fetches tournament with pairings even when info page has 0 rounds", async () => {
      const result = await provider.fetchTournament({
        sourceType: "chess-results",
        url: "https://s2.chess-results.com/tnr1233866.aspx?lan=1",
      });

      // The info page returns rounds=0, but standings have "after 9 Rounds"
      // Provider should use standings round count to fetch pairings
      expect(result.rounds).toBeGreaterThan(0);
      expect(result.pairings.length).toBeGreaterThan(0);
    });

    it("sets correct round count from standings", async () => {
      const result = await provider.fetchTournament({
        sourceType: "chess-results",
        url: "https://s2.chess-results.com/tnr1233866.aspx?lan=1",
      });

      expect(result.rounds).toBe(9);
      expect(result.currentRound).toBe(9);
    });

    it("includes all players", async () => {
      const result = await provider.fetchTournament({
        sourceType: "chess-results",
        url: "https://s2.chess-results.com/tnr1233866.aspx?lan=1",
      });

      expect(result.players.length).toBe(72);
    });

    it("sets tournament metadata", async () => {
      const result = await provider.fetchTournament({
        sourceType: "chess-results",
        url: "https://s2.chess-results.com/tnr1233866.aspx?lan=1",
      });

      expect(result.name).toBe("Rishon LeZion Summer Festival Blitz");
      expect(result.externalId).toBe("1233866");
      expect(result.sourceType).toBe("chess-results");
    });
  });
});
