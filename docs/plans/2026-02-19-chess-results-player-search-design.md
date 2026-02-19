# Chess-Results Player Search — Design

**Date:** 2026-02-19
**Feature:** Search chess-results.com by player name/FIDE ID, browse all their tournaments, queue bulk import as background jobs.

---

## Approach

Plain HTTP fetch-first with Playwright headless fallback.

- GET `spielersuche.aspx?lan=1` → extract `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`
- POST form with ViewState tokens + search params → parse results with cheerio
- If fetch returns no results table or throws → fall back to Playwright (headless Chromium, fill form, wait for table, same cheerio parser)

No Playwright by default — only spawned on failure.

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `lib/scrapers/chess-results-player-search.ts` | Scraper: fetch-first + Playwright fallback, returns `ChessResultsPlayer[]` |
| `app/api/players/chess-results-search/route.ts` | POST `{lastName, firstName, fideId}` → grouped player matches |
| `app/api/players/bulk-import/route.ts` | POST `{tournamentUrls[]}` → queues ImportJobs, returns `{queued, skipped}` |
| `app/players/search/page.tsx` | `/players/search` route |
| `components/features/chess-results-player-search.tsx` | Client component: form → player picker → tournament list → import button |

### Modified files

| File | Change |
|------|--------|
| `components/features/player-profile.tsx` | Add "Find on chess-results" button → `/players/search?lastName=…&firstName=…&fideId=…` |

---

## Scraper

### Form fields (POST body)

```
ctl00$P1$txt_nachname     last name
ctl00$P1$txt_vorname      first name
ctl00$P1$txt_fideID       FIDE ID
ctl00$P1$cb_suchen        "Search"  (submit trigger)
__VIEWSTATE               extracted from GET response
__VIEWSTATEGENERATOR      extracted from GET response
__EVENTVALIDATION         extracted from GET response
```

### Result type

```ts
interface ChessResultsPlayer {
  name: string;
  country: string | null;
  title: string | null;
  fideId: string | null;
  identNumber: string | null;  // chess-results internal ID
  tournaments: {
    name: string;
    url: string;       // https://chess-results.com/tnrXXXXX.aspx
    endDate: string;
    rounds: number | null;
  }[];
}
```

Results are grouped by player (name + country + fideId). Each row in the HTML table is a player+tournament pair.

---

## API Endpoints

### POST `/api/players/chess-results-search`

Request: `{ lastName: string, firstName?: string, fideId?: string }`
Response: `{ players: ChessResultsPlayer[] }`
Error: 400 if no search params, 502 if scrape fails.

### POST `/api/players/bulk-import`

Request: `{ tournamentUrls: string[] }`
Response: `{ queued: number, skipped: number, jobIds: string[] }`
- Skips URLs whose `sourceUrl` already exists in the DB (`tournament.sourceUrl`)
- Queues one `ImportJob` per new URL using existing import infrastructure

---

## UI Flow

### `/players/search` — three states

**State 1: Search form**
- Fields: Last name, First name, FIDE ID (all optional but at least one required)
- URL params `?lastName=&firstName=&fideId=` pre-fill the form
- Auto-triggers search on mount if any param is present

**State 2: Player picker**
- List of matching players (name, country, title, fideId)
- Radio select — user picks one
- "Confirm" button advances to state 3

**State 3: Tournament list**
- Shows all tournaments for selected player
- Each row: tournament name, end date, rounds + badge "imported" or "new"
- Summary: "X new, Y already imported"
- "Import X tournaments" button — calls bulk-import API, shows toast on success

### Player profile button

On `/players/{id}`, add a "Find on chess-results" button in the profile header.
Navigates to `/players/search?lastName={lastName}&firstName={firstName}&fideId={fideId}`.
Search auto-triggers on page load — user sees results immediately and can confirm/pick.

---

## Import behavior

- **Skip** tournaments already in DB (matched by `sourceUrl`)
- Queued as background `ImportJob` — reuses existing import infrastructure
- User notified via existing notification bell when jobs complete
- No refresh needed — user can navigate away immediately after queueing

---

## Error handling

- Scrape failure → 502 with message "Could not reach chess-results.com"
- No results → empty array, UI shows "No players found"
- Playwright fallback failure → same 502 (don't retry indefinitely)
- Bulk import: partial failures logged per job, don't fail the whole batch
