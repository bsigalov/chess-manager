# Chess-Results Player Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users search chess-results.com by name/FIDE ID, see all matching players' tournaments, and queue a bulk background import of new tournaments.

**Architecture:** Plain HTTP fetch (GET for ViewState, POST form) parsed with cheerio. Playwright headless fallback if fetch yields no results table. New `/players/search` page + "Find on chess-results" button on the player profile page. Bulk import reuses the existing `createImportJob` + `processImportJob` infrastructure.

**Tech Stack:** Next.js 16 App Router, TypeScript, cheerio, Playwright (fallback only), Prisma, existing `createImportJob`/`processImportJob` from `lib/import/import-service.ts`.

---

## Task 1: Scraper — fetch-first with Playwright fallback

**Files:**
- Create: `lib/scrapers/chess-results-player-search.ts`
- Create: `tests/fixtures/player-search-results.html`
- Create: `tests/unit/chess-results-player-search.test.ts`

### Step 1: Capture a real fixture

```bash
curl -c /tmp/cr-cookies.txt \
  "https://s3.chess-results.com/spielersuche.aspx?lan=1" \
  -o /tmp/cr-get.html

# Extract ViewState values from /tmp/cr-get.html, then POST:
python3 << 'EOF'
import re, subprocess
html = open("/tmp/cr-get.html").read()
vs   = re.search(r'__VIEWSTATE" value="([^"]+)"', html).group(1)
vsg  = re.search(r'__VIEWSTATEGENERATOR" value="([^"]+)"', html).group(1)
ev   = re.search(r'__EVENTVALIDATION" value="([^"]+)"', html).group(1)

import urllib.parse
body = urllib.parse.urlencode({
    "__VIEWSTATE": vs,
    "__VIEWSTATEGENERATOR": vsg,
    "__EVENTVALIDATION": ev,
    "ctl00$P1$txt_nachname": "Sigalov",
    "ctl00$P1$txt_vorname": "",
    "ctl00$P1$txt_fideID": "",
    "ctl00$P1$cb_suchen": "Search",
})

result = subprocess.run([
    "curl", "-s", "-b", "/tmp/cr-cookies.txt",
    "-X", "POST",
    "-H", "Content-Type: application/x-www-form-urlencoded",
    "https://s3.chess-results.com/spielersuche.aspx?lan=1",
    "--data-raw", body,
    "-o", "tests/fixtures/player-search-results.html"
], capture_output=True)
print("Done. Exit:", result.returncode)
EOF
```

Save the resulting HTML to `tests/fixtures/player-search-results.html`.

### Step 2: Write the failing test

```typescript
// tests/unit/chess-results-player-search.test.ts
import * as fs from "fs";
import * as path from "path";

const fixtureHtml = fs.readFileSync(
  path.join(__dirname, "../fixtures/player-search-results.html"),
  "utf-8"
);

// Mock fetchPage used internally by the scraper
jest.mock("@/lib/scrapers/chess-results-parser", () => ({
  ...jest.requireActual("@/lib/scrapers/chess-results-parser"),
  fetchPage: jest.fn(),
  delay: jest.fn().mockResolvedValue(undefined),
}));

import { fetchPage } from "@/lib/scrapers/chess-results-parser";
import { searchChessResultsPlayers } from "@/lib/scrapers/chess-results-player-search";

const mockedFetchPage = fetchPage as jest.MockedFunction<typeof fetchPage>;

describe("searchChessResultsPlayers", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns grouped player results from POST response", async () => {
    // GET call returns page with ViewState, POST call returns results
    mockedFetchPage
      .mockResolvedValueOnce(fixtureHtml)   // GET — to extract ViewState
      .mockResolvedValueOnce(fixtureHtml);  // POST — results page

    const results = await searchChessResultsPlayers({ lastName: "Sigalov" });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      name: expect.any(String),
      tournaments: expect.any(Array),
    });
    expect(results[0].tournaments[0]).toMatchObject({
      name: expect.any(String),
      url: expect.stringContaining("chess-results.com"),
    });
  });

  it("returns empty array when no results found", async () => {
    const emptyHtml = "<html><body>No results</body></html>";
    mockedFetchPage
      .mockResolvedValueOnce(emptyHtml)
      .mockResolvedValueOnce(emptyHtml);

    const results = await searchChessResultsPlayers({ lastName: "XYZZY_NOBODY" });
    expect(results).toEqual([]);
  });

  it("accepts fideId search", async () => {
    mockedFetchPage
      .mockResolvedValueOnce(fixtureHtml)
      .mockResolvedValueOnce(fixtureHtml);

    const results = await searchChessResultsPlayers({ fideId: "12345678" });
    expect(Array.isArray(results)).toBe(true);
  });
});
```

### Step 3: Run test — expect FAIL

```bash
npx jest tests/unit/chess-results-player-search.test.ts --no-cache 2>&1 | tail -10
```

Expected: `Cannot find module '@/lib/scrapers/chess-results-player-search'`

### Step 4: Implement the scraper

```typescript
// lib/scrapers/chess-results-player-search.ts
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

// Extract ASP.NET hidden form fields from a page's HTML
function extractViewState(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};
  for (const name of ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]) {
    const val = $(`input[name="${name}"]`).val() as string;
    if (val) fields[name] = val;
  }
  return fields;
}

// Parse results HTML table into grouped players
function parseSearchResults(html: string): ChessResultsPlayer[] {
  const $ = cheerio.load(html);
  const playerMap = new Map<string, ChessResultsPlayer>();

  // Results table rows (skip header)
  $("table.CRs1 tr, table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 4) return;

    const name = $(cells[0]).text().trim();
    if (!name) return;

    // Try to find a tournament link in the row
    const link = $(row).find("a[href*='tnr']");
    const href = link.attr("href") ?? "";
    const tournamentName = link.text().trim();

    if (!name || !tournamentName) return;

    const country = $(cells[1]).text().trim() || null;
    const title = $(cells[2]).text().trim() || null;
    const fideId = $(cells[3]).text().trim() || null;
    const identNumber = $(cells[4])?.text().trim() || null;
    const endDate = $(cells[5])?.text().trim() ?? "";
    const roundsText = $(cells[6])?.text().trim() ?? "";
    const rounds = parseInt(roundsText) || null;

    // Normalize tournament URL to absolute
    const url = href.startsWith("http")
      ? href
      : `${BASE_URL}/${href.replace(/^\.\//, "")}`;

    const key = `${name}|${fideId ?? ""}|${country ?? ""}`;
    if (!playerMap.has(key)) {
      playerMap.set(key, { name, country, title, fideId, identNumber, tournaments: [] });
    }
    playerMap.get(key)!.tournaments.push({ name: tournamentName, url, endDate, rounds });
  });

  return Array.from(playerMap.values());
}

async function fetchWithViewState(params: PlayerSearchParams): Promise<string> {
  // Step 1: GET to obtain fresh ViewState tokens
  const getHtml = await fetchPage(SEARCH_URL);
  const viewState = extractViewState(getHtml);

  if (!viewState.__VIEWSTATE) {
    throw new Error("Could not extract ViewState from chess-results.com");
  }

  // Step 2: POST the search form
  const body = new URLSearchParams({
    ...viewState,
    "ctl00$P1$txt_nachname": params.lastName ?? "",
    "ctl00$P1$txt_vorname": params.firstName ?? "",
    "ctl00$P1$txt_fideID": params.fideId ?? "",
    "ctl00$P1$cb_suchen": "Search",
  });

  await delay(1000);
  return fetchPage(`${SEARCH_URL}&_method=POST`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  } as RequestInit);
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
    const results = parseSearchResults(html);
    // If no results and it looks like a real response, try Playwright
    if (results.length === 0 && html.includes("__VIEWSTATE")) {
      html = await fetchWithPlaywright(params);
    } else {
      return results;
    }
  } catch {
    html = await fetchWithPlaywright(params);
  }

  return parseSearchResults(html);
}
```

**Note on `fetchPage` extension:** The existing `fetchPage` only accepts a URL. You'll need to modify `lib/scrapers/chess-results-parser.ts` to accept an optional second argument (RequestInit options) so the POST can be made. Change:

```typescript
// lib/scrapers/chess-results-parser.ts  (existing function, extend signature)
export async function fetchPage(url: string, options?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}
```

### Step 5: Run test — expect PASS

```bash
npx jest tests/unit/chess-results-player-search.test.ts --no-cache 2>&1 | tail -10
```

Expected: `3 passed`

### Step 6: Commit

```bash
git add lib/scrapers/chess-results-player-search.ts \
        lib/scrapers/chess-results-parser.ts \
        tests/unit/chess-results-player-search.test.ts \
        tests/fixtures/player-search-results.html
git commit -m "feat(CHESS-5): add chess-results player search scraper with Playwright fallback"
```

---

## Task 2: Search API endpoint

**Files:**
- Create: `app/api/players/chess-results-search/route.ts`

### Step 1: Write the failing test (API unit test)

Add to `tests/unit/chess-results-player-search.test.ts`:

```typescript
// Add at bottom of existing test file
import { POST as searchPost } from "@/app/api/players/chess-results-search/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/scrapers/chess-results-player-search", () => ({
  searchChessResultsPlayers: jest.fn(),
}));

import { searchChessResultsPlayers } from "@/lib/scrapers/chess-results-player-search";
const mockedSearch = searchChessResultsPlayers as jest.MockedFunction<typeof searchChessResultsPlayers>;

describe("POST /api/players/chess-results-search", () => {
  it("returns players from scraper", async () => {
    mockedSearch.mockResolvedValue([
      { name: "Sigalov, Boris", country: "ISR", title: null, fideId: "12345", identNumber: null,
        tournaments: [{ name: "Test Open", url: "https://chess-results.com/tnr1.aspx", endDate: "2024-01-01", rounds: 7 }] }
    ]);

    const req = new NextRequest("http://localhost/api/players/chess-results-search", {
      method: "POST",
      body: JSON.stringify({ lastName: "Sigalov" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await searchPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.players).toHaveLength(1);
    expect(data.players[0].name).toBe("Sigalov, Boris");
  });

  it("returns 400 when no search params", async () => {
    const req = new NextRequest("http://localhost/api/players/chess-results-search", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const res = await searchPost(req);
    expect(res.status).toBe(400);
  });
});
```

### Step 2: Run test — expect FAIL

```bash
npx jest tests/unit/chess-results-player-search.test.ts --no-cache 2>&1 | tail -10
```

### Step 3: Implement the route

```typescript
// app/api/players/chess-results-search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { searchChessResultsPlayers } from "@/lib/scrapers/chess-results-player-search";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lastName, firstName, fideId } = body as {
      lastName?: string;
      firstName?: string;
      fideId?: string;
    };

    if (!lastName && !firstName && !fideId) {
      return NextResponse.json(
        { error: "At least one search parameter required (lastName, firstName, or fideId)" },
        { status: 400 }
      );
    }

    const players = await searchChessResultsPlayers({ lastName, firstName, fideId });
    return NextResponse.json({ players });
  } catch (error) {
    console.error("chess-results search error:", error);
    return NextResponse.json(
      { error: "Failed to search chess-results.com" },
      { status: 502 }
    );
  }
}
```

### Step 4: Run test — expect PASS

```bash
npx jest tests/unit/chess-results-player-search.test.ts --no-cache 2>&1 | tail -10
```

### Step 5: Commit

```bash
git add app/api/players/chess-results-search/route.ts \
        tests/unit/chess-results-player-search.test.ts
git commit -m "feat(CHESS-5): add POST /api/players/chess-results-search endpoint"
```

---

## Task 3: Bulk import API endpoint

**Files:**
- Create: `app/api/players/bulk-import/route.ts`
- Create: `tests/unit/bulk-import.test.ts`

### Step 1: Write the failing test

```typescript
// tests/unit/bulk-import.test.ts
import { POST as bulkImportPost } from "@/app/api/players/bulk-import/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/db", () => ({ prisma: { tournament: { findMany: jest.fn() } } }));
jest.mock("@/lib/import/import-service", () => ({
  createImportJob: jest.fn(),
  processImportJob: jest.fn(),
}));

import { prisma } from "@/lib/db";
import { createImportJob, processImportJob } from "@/lib/import/import-service";

const mockedFindMany = prisma.tournament.findMany as jest.MockedFunction<typeof prisma.tournament.findMany>;
const mockedCreate = createImportJob as jest.MockedFunction<typeof createImportJob>;
const mockedProcess = processImportJob as jest.MockedFunction<typeof processImportJob>;

describe("POST /api/players/bulk-import", () => {
  beforeEach(() => jest.clearAllMocks());

  it("queues new tournaments and skips existing ones", async () => {
    const urls = [
      "https://chess-results.com/tnr1.aspx",
      "https://chess-results.com/tnr2.aspx",
    ];
    // tnr1 already in DB
    mockedFindMany.mockResolvedValue([{ sourceUrl: urls[0] }] as never);
    mockedCreate.mockResolvedValue("job-abc");
    mockedProcess.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/players/bulk-import", {
      method: "POST",
      body: JSON.stringify({ tournamentUrls: urls }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await bulkImportPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.queued).toBe(1);
    expect(data.skipped).toBe(1);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith(
      { sourceType: "chess-results", url: urls[1] },
      undefined
    );
  });

  it("returns 400 for empty URL list", async () => {
    const req = new NextRequest("http://localhost/api/players/bulk-import", {
      method: "POST",
      body: JSON.stringify({ tournamentUrls: [] }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await bulkImportPost(req);
    expect(res.status).toBe(400);
  });
});
```

### Step 2: Run test — expect FAIL

```bash
npx jest tests/unit/bulk-import.test.ts --no-cache 2>&1 | tail -10
```

### Step 3: Implement the route

```typescript
// app/api/players/bulk-import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createImportJob, processImportJob } from "@/lib/import/import-service";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tournamentUrls } = body as { tournamentUrls: string[] };

    if (!tournamentUrls || tournamentUrls.length === 0) {
      return NextResponse.json(
        { error: "tournamentUrls must be a non-empty array" },
        { status: 400 }
      );
    }

    // Find already-imported tournaments by sourceUrl
    const existing = await prisma.tournament.findMany({
      where: { sourceUrl: { in: tournamentUrls } },
      select: { sourceUrl: true },
    });
    const existingUrls = new Set(existing.map((t) => t.sourceUrl));

    const newUrls = tournamentUrls.filter((url) => !existingUrls.has(url));

    const user = await getCurrentUser().catch(() => null);
    const jobIds: string[] = [];

    for (const url of newUrls) {
      const jobId = await createImportJob(
        { sourceType: "chess-results", url },
        user?.id
      );
      jobIds.push(jobId);
      // Fire-and-forget: process in background
      processImportJob(jobId).catch((err) =>
        console.error(`Import job ${jobId} failed:`, err)
      );
    }

    return NextResponse.json({
      queued: newUrls.length,
      skipped: existingUrls.size,
      jobIds,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json(
      { error: "Bulk import failed" },
      { status: 500 }
    );
  }
}
```

### Step 4: Run test — expect PASS

```bash
npx jest tests/unit/bulk-import.test.ts --no-cache 2>&1 | tail -10
```

### Step 5: Commit

```bash
git add app/api/players/bulk-import/route.ts tests/unit/bulk-import.test.ts
git commit -m "feat(CHESS-5): add POST /api/players/bulk-import endpoint"
```

---

## Task 4: Search UI component

**Files:**
- Create: `components/features/chess-results-player-search.tsx`

### Step 1: Implement the component

Three internal states: `idle → results → tournaments`.

```typescript
// components/features/chess-results-player-search.tsx
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TitleBadge } from "@/components/ui/title-badge";
import { toast } from "sonner";
import type { ChessResultsPlayer } from "@/lib/scrapers/chess-results-player-search";

interface TournamentWithStatus {
  name: string;
  url: string;
  endDate: string;
  rounds: number | null;
  alreadyImported: boolean;
}

type State = "idle" | "searching" | "picking" | "importing" | "done";

export function ChessResultsPlayerSearch() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [lastName, setLastName] = useState(searchParams.get("lastName") ?? "");
  const [firstName, setFirstName] = useState(searchParams.get("firstName") ?? "");
  const [fideId, setFideId] = useState(searchParams.get("fideId") ?? "");

  const [state, setState] = useState<State>("idle");
  const [players, setPlayers] = useState<ChessResultsPlayer[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [tournaments, setTournaments] = useState<TournamentWithStatus[]>([]);

  // Auto-trigger search if URL params are present
  useEffect(() => {
    if (lastName || fideId) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch() {
    if (!lastName && !firstName && !fideId) {
      toast.error("Enter at least a last name or FIDE ID");
      return;
    }
    setState("searching");
    setPlayers([]);
    setSelectedIdx(null);
    setTournaments([]);

    try {
      const res = await fetch("/api/players/chess-results-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastName, firstName, fideId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlayers(data.players ?? []);
      setState("picking");
    } catch (err) {
      toast.error(`Search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setState("idle");
    }
  }

  async function handleConfirmPlayer() {
    if (selectedIdx === null) return;
    const player = players[selectedIdx];

    // Check which tournaments are already imported
    const res = await fetch("/api/players/bulk-import/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentUrls: player.tournaments.map((t) => t.url) }),
    });
    // Fallback: assume none imported if check fails
    const urls: string[] = res.ok ? (await res.json()).existingUrls ?? [] : [];
    const existingSet = new Set(urls);

    setTournaments(
      player.tournaments.map((t) => ({
        ...t,
        alreadyImported: existingSet.has(t.url),
      }))
    );
    setState("picking"); // stays in picking state but shows tournament list
  }

  async function handleImport() {
    const newUrls = tournaments
      .filter((t) => !t.alreadyImported)
      .map((t) => t.url);

    if (newUrls.length === 0) {
      toast.info("All tournaments already imported");
      return;
    }

    setState("importing");
    try {
      const res = await fetch("/api/players/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentUrls: newUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(
        `Queued ${data.queued} tournament${data.queued !== 1 ? "s" : ""} for import. Check notifications for progress.`
      );
      setState("done");
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setState("picking");
    }
  }

  const newCount = tournaments.filter((t) => !t.alreadyImported).length;
  const selectedPlayer = selectedIdx !== null ? players[selectedIdx] : null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Search form */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Last name</label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. Sigalov"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">First name</label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. Boris"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">FIDE ID</label>
          <Input
            value={fideId}
            onChange={(e) => setFideId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. 2805070"
            className="max-w-[200px]"
          />
        </div>
        <Button onClick={handleSearch} disabled={state === "searching"}>
          {state === "searching" ? "Searching…" : "Search chess-results.com"}
        </Button>
      </div>

      {/* Player picker */}
      {state !== "idle" && state !== "searching" && players.length > 0 && !selectedPlayer && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {players.length} player{players.length !== 1 ? "s" : ""} found — select one:
          </p>
          <div className="space-y-1.5">
            {players.map((p, i) => (
              <label
                key={i}
                className={`flex items-center gap-3 p-2.5 rounded border cursor-pointer text-sm transition-colors ${
                  selectedIdx === i
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="player"
                  checked={selectedIdx === i}
                  onChange={() => setSelectedIdx(i)}
                />
                <TitleBadge title={p.title} />
                <span className="font-medium">{p.name}</span>
                {p.country && <span className="text-muted-foreground">{p.country}</span>}
                {p.fideId && <span className="text-muted-foreground font-mono text-xs">FIDE {p.fideId}</span>}
                <span className="ml-auto text-muted-foreground text-xs">
                  {p.tournaments.length} tournament{p.tournaments.length !== 1 ? "s" : ""}
                </span>
              </label>
            ))}
          </div>
          <Button onClick={handleConfirmPlayer} disabled={selectedIdx === null}>
            View tournaments
          </Button>
        </div>
      )}

      {players.length === 0 && state === "picking" && (
        <p className="text-sm text-muted-foreground">No players found. Try a different search.</p>
      )}

      {/* Tournament list */}
      {selectedPlayer && tournaments.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{selectedPlayer.name} — {tournaments.length} tournaments</p>
          <div className="border rounded divide-y text-sm max-h-80 overflow-y-auto">
            {tournaments.map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 truncate">{t.name}</span>
                <span className="text-muted-foreground text-xs shrink-0">{t.endDate}</span>
                {t.alreadyImported ? (
                  <Badge variant="secondary" className="shrink-0">imported</Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-emerald-600 border-emerald-300">new</Badge>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {newCount} new · {tournaments.length - newCount} already imported
          </p>
          {state === "done" ? (
            <p className="text-sm text-emerald-600">✓ Import queued — check the notification bell for progress</p>
          ) : (
            <Button
              onClick={handleImport}
              disabled={state === "importing" || newCount === 0}
            >
              {state === "importing" ? "Queuing…" : `Import ${newCount} tournament${newCount !== 1 ? "s" : ""}`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Note:** The component references a `POST /api/players/bulk-import/check` endpoint for pre-checking which URLs are already imported. Add this to `app/api/players/bulk-import/route.ts`:

```typescript
// Add alongside existing POST in bulk-import/route.ts
export async function PUT(request: NextRequest) {
  // Check which URLs already exist (used by UI before showing import button)
  const body = await request.json();
  const { tournamentUrls } = body as { tournamentUrls: string[] };
  const existing = await prisma.tournament.findMany({
    where: { sourceUrl: { in: tournamentUrls } },
    select: { sourceUrl: true },
  });
  return NextResponse.json({ existingUrls: existing.map((t) => t.sourceUrl) });
}
```

Change the component's fetch to `PUT` instead of targeting `/check`:
```typescript
const res = await fetch("/api/players/bulk-import", {
  method: "PUT",
  ...
});
```

### Step 2: TypeScript check

```bash
npx tsc --noEmit 2>&1 | tail -15
```

Fix any errors before committing.

### Step 3: Commit

```bash
git add components/features/chess-results-player-search.tsx \
        app/api/players/bulk-import/route.ts
git commit -m "feat(CHESS-5): add ChessResultsPlayerSearch UI component and bulk-import PUT check"
```

---

## Task 5: Search page + player profile button

**Files:**
- Create: `app/players/search/page.tsx`
- Modify: `components/features/player-profile.tsx`

### Step 1: Create the search page

```typescript
// app/players/search/page.tsx
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ChessResultsPlayerSearch } from "@/components/features/chess-results-player-search";

export const metadata = { title: "Find Player — chess-results.com" };

export default function PlayerSearchPage() {
  return (
    <div className="container px-4 py-8 max-w-3xl">
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "Players", href: "/players" },
        { label: "Find on chess-results.com" },
      ]} />
      <h1 className="text-xl font-bold mb-1">Find Player on chess-results.com</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Search by name or FIDE ID to discover all tournaments and import game data.
      </p>
      <Suspense>
        <ChessResultsPlayerSearch />
      </Suspense>
    </div>
  );
}
```

### Step 2: Add button to player profile

Read `components/features/player-profile.tsx` first. Find the header area near the `FollowButton` (around line 185). Add the "Find on chess-results" button after it:

```typescript
// Add import at top:
import { useRouter } from "next/navigation";

// In component body, add helper:
const router = useRouter();

function handleFindOnChessResults() {
  const parts = player.name.split(/[\s,]+/);
  const lastName = parts[0] ?? "";
  const firstName = parts[1] ?? "";
  const params = new URLSearchParams();
  if (lastName) params.set("lastName", lastName);
  if (firstName) params.set("firstName", firstName);
  if (player.fideId) params.set("fideId", player.fideId);
  router.push(`/players/search?${params.toString()}`);
}

// Add button after FollowButton (around line 186):
<Button variant="outline" size="sm" onClick={handleFindOnChessResults}>
  Find on chess-results.com
</Button>
```

### Step 3: TypeScript + full test run

```bash
npx tsc --noEmit 2>&1 | tail -10
npm test 2>&1 | tail -10
```

Expected: all tests pass, no TypeScript errors.

### Step 4: Commit

```bash
git add app/players/search/page.tsx components/features/player-profile.tsx
git commit -m "feat(CHESS-5): add /players/search page and Find on chess-results button"
```

---

## Task 6: Final verification

### Step 1: Run full test suite

```bash
npm test 2>&1 | tail -15
```

Expected: all test suites pass (including the 2 new ones).

### Step 2: TypeScript check

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

### Step 3: Manual smoke test (dev server must be running on port 3002)

1. Navigate to `http://localhost:3002/players/search`
2. Search for a player by last name (e.g. "Carlsen")
3. Verify player list appears with name/country/title/tournament count
4. Select a player, verify tournament list appears with new/imported badges
5. Navigate to any existing player page — verify "Find on chess-results.com" button is present
6. Click the button — verify it navigates to `/players/search` with form pre-filled and search auto-triggered

### Step 4: Final commit (if any cleanup needed)

```bash
git add -A
git commit -m "feat(CHESS-5): chess-results player search — complete"
```
