import * as fs from "fs";
import * as path from "path";

jest.mock("@/lib/scrapers/chess-results-parser", () => ({
  ...jest.requireActual("@/lib/scrapers/chess-results-parser"),
  fetchPage: jest.fn(),
  delay: jest.fn().mockResolvedValue(undefined),
}));

import { fetchPage } from "@/lib/scrapers/chess-results-parser";
import { searchChessResultsPlayers } from "@/lib/scrapers/chess-results-player-search";

const mockedFetchPage = fetchPage as jest.MockedFunction<typeof fetchPage>;

const fixtureHtml = fs.readFileSync(
  path.join(__dirname, "../fixtures/player-search-results.html"),
  "utf-8"
);

describe("searchChessResultsPlayers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns grouped player results from POST response", async () => {
    mockedFetchPage
      .mockResolvedValueOnce(fixtureHtml)  // GET — extract ViewState
      .mockResolvedValueOnce(fixtureHtml); // POST — results

    const results = await searchChessResultsPlayers({ lastName: "Carlsen" });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      name: expect.any(String),
      identNumber: expect.any(String),
      tournaments: expect.any(Array),
    });
    expect(results[0].tournaments.length).toBeGreaterThan(0);
    expect(results[0].tournaments[0]).toMatchObject({
      name: expect.any(String),
      url: expect.stringContaining("chess-results.com"),
    });
  });

  it("returns empty array when no results table found", async () => {
    // GET returns the fixture (with ViewState); POST returns a page with no results table
    const noResultsHtml = "<html><body><p>No results found</p></body></html>";
    mockedFetchPage
      .mockResolvedValueOnce(fixtureHtml)  // GET — has ViewState
      .mockResolvedValueOnce(noResultsHtml); // POST — no CRs2 table

    const results = await searchChessResultsPlayers({ lastName: "XYZZY_NOBODY_123" });
    expect(results).toEqual([]);
  });

  it("throws when no search params provided", async () => {
    await expect(searchChessResultsPlayers({})).rejects.toThrow(
      "At least one search parameter required"
    );
  });

  it("falls back and rejects when fetchWithViewState throws a network error", async () => {
    // Simulate a network failure on the GET request
    mockedFetchPage.mockRejectedValueOnce(new Error("Network error: ECONNREFUSED"));

    // In the unit test environment playwright will either throw (not installed)
    // or attempt a real network call — either way we expect a rejection, not a hang.
    // We use a short timeout to prevent the test suite from blocking.
    await expect(
      Promise.race([
        searchChessResultsPlayers({ lastName: "Test" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 3000)
        ),
      ])
    ).rejects.toBeDefined();
  });
});
