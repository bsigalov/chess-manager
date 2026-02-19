jest.mock("@/lib/scrapers/chess-results-player-search", () => ({
  searchChessResultsPlayers: jest.fn(),
}));

import { searchChessResultsPlayers } from "@/lib/scrapers/chess-results-player-search";
import { POST } from "@/app/api/players/chess-results-search/route";
import { NextRequest } from "next/server";

const mockedSearch = searchChessResultsPlayers as jest.MockedFunction<
  typeof searchChessResultsPlayers
>;

function makeRequest(body: object) {
  return new NextRequest(
    "http://localhost/api/players/chess-results-search",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  );
}

function makeRawRequest(body: string) {
  return new NextRequest(
    "http://localhost/api/players/chess-results-search",
    {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    }
  );
}

describe("POST /api/players/chess-results-search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when no params provided", async () => {
    const req = makeRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("At least one search parameter is required");
  });

  it("returns 400 when all params are empty strings", async () => {
    const req = makeRequest({ lastName: "", firstName: "", fideId: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("At least one search parameter is required");
  });

  it("returns 200 with players when search succeeds", async () => {
    const mockPlayers = [
      {
        name: "Kasparov, Garry",
        country: "RUS",
        title: "GM",
        fideId: "4100018",
        identNumber: "12345",
        tournaments: [
          {
            name: "World Championship 1985",
            url: "https://chess-results.com/tnr123.aspx",
            endDate: "1985-11-09",
            rounds: 24,
          },
        ],
      },
    ];
    mockedSearch.mockResolvedValueOnce(mockPlayers);

    const req = makeRequest({ lastName: "Kasparov" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.players).toEqual(mockPlayers);
    expect(mockedSearch).toHaveBeenCalledWith({ lastName: "Kasparov" });
  });

  it("passes only provided params to scraper", async () => {
    mockedSearch.mockResolvedValueOnce([]);

    const req = makeRequest({ firstName: "Magnus", fideId: "1503014" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockedSearch).toHaveBeenCalledWith({
      firstName: "Magnus",
      fideId: "1503014",
    });
  });

  it("returns 400 when body is malformed JSON", async () => {
    const req = makeRawRequest("{not valid json");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid request body");
  });

  it("returns 502 when scraper throws", async () => {
    mockedSearch.mockRejectedValueOnce(new Error("Connection refused"));

    const req = makeRequest({ lastName: "Fischer" });
    const res = await POST(req);
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("Could not reach chess-results.com");
    expect(json.details).toBe("Connection refused");
  });
});
