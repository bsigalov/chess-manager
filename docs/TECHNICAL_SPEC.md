# Chess Manager — Technical Specification

> Living document. Audience: project owner + Claude Code.  
> Last updated: 2026-02-20

---

## 1. Project Overview

Chess Manager is a cloud-hosted web application that imports chess tournaments from external sources and provides enhanced viewing, analytics, and player-following features that those sources lack.

### Problem

Sites like chess-results.com are the de-facto standard for publishing tournament data, but their UX is poor: no personal tracking, no analytics, no notifications, and no way to follow specific players across events.

### What It Does

- Import any tournament by URL (chess-results.com today; more sources planned)
- View standings, pairings, and crosstable with a modern UI
- Follow specific players and receive notifications on their results
- Analyze performance with Elo calculations, tiebreaks, and Monte Carlo simulations
- Export data in PGN, CSV, and PDF formats

### Supported Formats

All time controls: blitz, rapid, classical, and variants.

### Users & Auth

Anyone can register and log in. Roles: `viewer` → `player` → `organizer` → `admin`.
Browsing tournaments is public. Personal features (following, bookmarks, notifications) require login.

### Project Status

Personal project, actively developed. No public deployment. Dev server runs locally on port 3002.

### Getting Started

```bash
git clone <repo> && cd chess-manager
npm install
# Copy .env.example → .env and fill in:
#   DATABASE_URL=postgresql://...
#   REDIS_URL=redis://localhost:6379
#   NEXTAUTH_SECRET=<random string>
#   NEXT_PUBLIC_API_URL=http://localhost:3002
npx prisma migrate dev          # create tables
npm run dev                     # starts on port 3002
```

Prerequisites: Node.js 20+, PostgreSQL, Redis (for BullMQ + cache; app degrades gracefully without it).

---

## 2. Architecture & Tech Stack

### Architecture Pattern

Single Next.js monolith. No separate backend service — API routes, scraping, background workers, and frontend all live in the same codebase. This keeps deployment simple at the cost of some separation of concerns.

```
Browser → Next.js App Router
              ├── /app/api/**       API routes (REST)
              ├── /app/**           Pages (React Server Components + Client Components)
              ├── /lib/scrapers/    HTML scraping (cheerio, no Playwright)
              ├── /lib/import/      Import pipeline & diff engine
              ├── /lib/analytics/   Elo, tiebreaks, Monte Carlo, what-if
              └── /lib/events/      Internal event bus (SSE delivery)
```

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4, Shadcn/ui (Radix UI) |
| Database | PostgreSQL via Prisma 7 + `@prisma/adapter-pg` |
| Auth | NextAuth v5 (`@auth/prisma-adapter`) |
| Background jobs | BullMQ + Redis (ioredis) |
| Scraping | cheerio (server-side HTML parsing) |
| Cache | Two-tier: in-process LRU cache → Redis |
| Charts | Chart.js + react-chartjs-2 |
| Real-time | Server-Sent Events (SSE) via `/api/events` |
| Testing | Jest (unit) + Playwright (e2e) |

### Key Architectural Decisions

- **Monolith over microservices**: simplifies deployment and local dev; revisit if scraping becomes a bottleneck
- **Two-tier cache**: LRU in-process for hot data, Redis for shared state across restarts
- **cheerio over Playwright**: chess-results.com renders server-side HTML — no JS execution needed, so cheerio is sufficient and much faster
- **Prisma 7**: requires `prisma.config.ts` and driver adapter (`@prisma/adapter-pg`); JSON fields need `JSON.parse(JSON.stringify(...))` roundtrip for `InputJsonValue` compatibility
- **Next.js 15+ async params**: `params`, `cookies()`, and `headers()` are async in route handlers — always `await` them

### Import Pipeline

```
User pastes URL → POST /api/tournaments/import
    │
    ├── createImportJob() → persist to DB, status='pending'
    ├── processImportJob():
    │     1. scrapeTournamentInfo()     — name, venue, dates, rounds, status
    │     2. scrapePlayerList()         — all players with title, rating, FIDE ID
    │     3. scrapeStandings()          — final ranking with points & tiebreaks
    │     4. scrapePairings(round) × N  — each round's board pairings + results
    │     5. scrapeCrosstable()         — NxN head-to-head matrix
    │     6. upsertTournament()         — diff & store in PostgreSQL
    │     → status='completed' with result stats
    └── On error → status='failed' with error message
```

2-second delay between each scrape request to respect chess-results.com rate limits.

### Caching

Two-tier via `cachedFetch(key, fetcher, options)` in `lib/cache/`:

| Tier | Implementation | Default TTL | Max entries |
|---|---|---|---|
| L1 — Memory | LRU-Cache (in-process) | 30 seconds | 1,000 keys |
| L2 — Redis | ioredis with JSON serialize | 5 minutes | unlimited |

Lookup order: L1 → L2 → fetcher → store in both. Gracefully degrades if Redis is unavailable.

Key operations:
- `cacheInvalidate(pattern)` — SCAN + DEL for pattern matching (e.g., `tournament:abc:*`)
- Tournament refresh busts the cache for that tournament's keys
- Crosstable is also cached in `tournament.metadata.crosstable` (DB-level, persists across restarts)

### chess-results.com Scraping Quirks

These are critical for anyone touching `lib/scrapers/`:

| `art=` param | Page type | Key quirk |
|---|---|---|
| `art=0` | Player List | Title (GM/IM/FM) is always in its own `<td>` cell — `row[1]` may be empty for untitled players |
| `art=1` | Final Ranking | Has a Club/City column between Rating and Points — parser must skip non-numeric columns to find points |
| `art=2` | Pairings | Result column found by pattern matching (`" - "`, `"½"`, `"+:-"`). White/black split around it. "No." columns contain starting numbers (integers ≤100) that look like points — must be skipped |
| `art=4` | Crosstable | Cells like `"13w1"` = opponent rank 13, white, won. `"56b½"` = opponent 56, black, draw. Also handles BYE, forfeits, `"+:-"` |

Other gotchas:
- **Round count bug**: info page sometimes returns `rounds: 0` — parser uses `gamesPlayed` from standings as fallback
- **Rating validation**: only accept 100–3500; anything outside is treated as unrated
- **Title recognition**: GM, IM, FM, WGM, WIM, WFM, CM, WCM, NM

### Adding a New Data Source

The scraper pattern is pluggable via `sourceType` on Tournament. To add a new source:

1. Create a new parser in `lib/scrapers/` (e.g., `lichess-parser.ts`)
2. Implement the same normalized output interface: tournament info, player list, standings, pairings, crosstable
3. Register the source type in `lib/import/import-service.ts` (provider resolution logic)
4. The `Tournament.sourceType` field stores which parser to use on refresh
5. All downstream code (analytics, UI, export) works with normalized data — no source-specific logic needed

---

## 3. Data Models

Schema: `prisma/schema.prisma`. All tables use UUID primary keys (`gen_random_uuid()`).

### Entity Relationship Diagram

```
User ──< FollowedPlayer >── Player
 │                            │
 ├── UserPreference           ├──< PlayerAlias
 ├──< Notification            ├──< PlayerClaim >── User
 ├──< UserTournamentBookmark  ├──< RatingHistory
 │         │                  │
 │         └──── Tournament ──┤
 │                    │       │
 │                    ├──< TournamentPlayer (join table)
 │                    ├──< Pairing ── Game ──< Move ──< MoveAnnotation
 │                    ├──< TournamentSnapshot
 │                    ├──< DataSyncLog
 │                    └──< RoundSnapshot
 │
 └── Account, Session (NextAuth)
```

### Model Groups

**Auth** — Standard NextAuth models (`User`, `Account`, `Session`, `VerificationToken`). User has role (`anonymous` → `viewer` → `player` → `organizer` → `admin`) and optional `claimedPlayerId` linking to their real chess identity.

**Core** — `Tournament`, `Player`, `TournamentPlayer` (many-to-many join), `Pairing`. Tournament stores `metadata` as JSONB (used for cached crosstable data). `TournamentPlayer` tracks per-tournament stats: starting/current rank, rating, points, games played, performance.

**Game & Move** — `Game` extends `Pairing` (1:1). `Move` stores everything: SAN/UCI notation, piece movement, captures, checks, clock times, engine evaluations (`evaluationCp`, `bestMove`, `engineDepth`), NAG codes. `MoveAnnotation` is extensible (type + JSON data). **Note:** Move-level data requires PGN import — chess-results.com doesn't provide it.

**User Features** — `FollowedPlayer`, `UserTournamentBookmark`, `UserPreference`, `Notification`. All support notification toggling per entity.

**Player Identity** — `PlayerAlias` (name variants across sources), `PlayerClaim` (user claims to be a player, with verification), `RatingHistory` (multiple rating types over time).

**Import & Sync** — `ImportJob` and `ScrapingJob` track background work. `DataSyncLog` records each sync attempt with duration and changes summary.

**Analytics** — `TournamentSnapshot` (standings JSON per round), `RoundSnapshot` (per-player per-round points/rank/performance tracking).

### Key Patterns

- All UUIDs, no auto-increment IDs
- `metadata: Json? @db.JsonB` on most core models for extensibility
- Snake-case DB column names via `@map()`, camelCase in TypeScript
- Cascade deletes from Tournament → all child records
- Composite unique constraints: `[tournamentId, round, board]` on Pairing/Game, `[tournamentId, playerId]` on TournamentPlayer

---

## 4. Feature Inventory

Status legend: **Built** = working end-to-end · **Partial** = API/backend exists, limited UI · **Schema** = DB model only

### Built — Pages & Routes

| Route | What it does |
|---|---|
| `/` | Home — recent tournaments, import form, my players section |
| `/dashboard` | Followed players, bookmarked tournaments, notification feed |
| `/tournaments` | Searchable/filterable tournament list (grid cards) |
| `/tournaments/[id]` | Tabbed detail: Standings, Pairings, Crosstable, Analytics, Predictions, Magic Numbers. Export (CSV/PGN/PDF), refresh, bookmark |
| `/tournaments/[id]/players/[playerId]` | Player journey — game-by-game record, rating/rank progression charts, stats |
| `/tournaments/[id]/games/[gameId]` | Individual game detail |
| `/players` | Player database — sorted by rating, paginated |
| `/players/[id]` | Global profile — FIDE ID, ratings, tournament history, aliases, follow/claim |
| `/players/search` | chess-results.com external player search |
| `/compare` | Head-to-head — autocomplete search, historical matchups, win probability chart |
| `/auth/signin` | Email/password + OAuth (Google, GitHub) |
| `/auth/register` | Registration |
| `/settings` | Theme, language, notification preferences |

### Built — Core Features

- **Tournament Import**: paste chess-results.com URL → scrape info, standings, pairings, crosstable → store everything
- **Data Refresh**: manual rescrape of a tournament's current state
- **Export**: CSV (standings/player list), PGN (all games), PDF (structured report)
- **Player Following**: follow players → dashboard display, notification preferences per player
- **Tournament Bookmarks**: bookmark tournaments → dashboard display, notification toggle
- **Player Claims**: users can claim to be a real player (pending → approved → rejected)
- **Notifications**: in-app feed with unread count, mark-as-read, bulk ops, delete
- **SSE Real-time**: subscribe to tournament updates via `/api/events`, multi-tournament support
- **Auth**: NextAuth with credentials + Google + GitHub OAuth, role-based access

### Built — Analytics

- Elo expected score & performance rating (FIDE formula)
- Tiebreak calculations (Buchholz, Sonneborn-Berger, etc.)
- Player stats: W/D/L, white vs. black performance, score trajectory
- Monte Carlo simulation (10k–100k iterations for outcome probabilities)
- What-if scenarios (simulate hypothetical results, recalculate standings)
- Magic numbers (mathematical clinch/elimination thresholds)
- Opening statistics (win rate by ECO code)
- Score trajectory & win probability charts (Chart.js)

### Partial — Backend Built, Limited UI

| Feature | What exists | What's missing |
|---|---|---|
| Async import pipeline | `ImportJob` API, job status tracking, file import endpoint | No file upload UI, job progress UI not integrated |
| Tournament snapshots | `TournamentSnapshot` model, `/api/tournaments/[id]/snapshots` | No UI for browsing snapshot history |
| Data sync & quality | Sync logger, manual override system, snapshot service | No admin dashboard for sync history |
| Rating history | DB model, scraped during import, shown on profile | No dedicated historical chart component |

### Schema Only — Not Yet Implemented

| Model | Purpose | Why it exists |
|---|---|---|
| `Move` + `MoveAnnotation` | Per-move storage with engine eval, clock times, NAG codes | Prepared for PGN import — chess-results.com doesn't provide move data |
| `PlayerAlias` | Name variants across sources | Populated during import, no management UI |
| `ScrapingJob` | Background scrape tracking | Legacy model, not actively used |
| `VerificationToken` | Email verification | NextAuth standard, no email sending configured |

---

## 5. Analytics Engine

All analytics live in `lib/analytics/`. The crosstable (scraped from chess-results.com `art=4`) is the primary input — it's cached in `tournament.metadata.crosstable` after first scrape.

### Modules

**`elo.ts`** — FIDE rating math
- `expectedScore(ratingA, ratingB)` — sigmoid: `1 / (1 + 10^((Rb-Ra)/400))`
- `kFactor(rating)` — tiered: 40 (<2300), 20 (2300–2399), 10 (2400+)
- `ratingChange(player, opponent, result)` — `K × (actual - expected)`
- `computeRatingProgression(startRating, games[])` — cumulative round-by-round rating evolution
- `winDrawLossProbability(whiteElo, blackElo)` — includes ~50 Elo white bonus, draw model: `min(2×E×(1-E), 0.5)`
- `performanceRating(results[])` — TPR: `avgOppRating + 400×(W-L)/N`

**`tiebreaks.ts`** — FIDE tiebreak systems
- `buchholz(playerRank, crosstable)` — sum of all opponents' total points (BYE = own points)
- `sonnebornBerger(playerRank, crosstable)` — sum of (opponent points × score against them)

**`standings.ts`** — Rankings with tiebreaks
- `computeStandings(crosstable)` — sorts by: points → Buchholz → Sonneborn-Berger, assigns ranks
- `computeStandingsAfterRound(crosstable, round)` — truncates crosstable to round N, recomputes standings (used for rank progression charts)

**`player-stats.ts`** — Individual player analytics
- `computePlayerStats(playerRank, crosstable)` — W/D/L, white/black breakdown, avg opponent rating, TPR, cumulative score progression

**`monte-carlo.ts`** — Tournament outcome simulation
- `runSimulation(crosstable, totalRounds, iterations=50k)` — simulates remaining rounds using Swiss pairing approximation + Elo-based win/draw/loss probabilities. Returns per-player: P(1st), P(top-3), expected points, std dev, full position distribution
- `buildDeterministicResult(players, totalRounds, completedRounds)` — 100% confidence for completed tournaments

**`what-if.ts`** — Hypothetical scenarios
- `applyHypotheticalResults(crosstable, hypotheticals[])` — deep-clones crosstable, injects hypothetical results for both players, recalculates points. Non-mutating
- `whatDoesPlayerNeed(playerRank, crosstable, totalRounds, targetPosition)` — "needs X points from Y remaining games" or "mathematically impossible"

### API Endpoints

**`GET /api/tournaments/[id]/analytics`** — Full analytics report:
```
{ standings, playerStats, rankProgression, simulation, totalRounds }
```
Simulation only runs if tournament is ongoing. Default 10k iterations.

**`POST /api/tournaments/[id]/simulate`** — Custom what-if:
```
Request:  { iterations?, hypotheticals?: [{playerRank, opponentRank, round, score}] }
Response: { iterations, totalRounds, completedRounds, players[] }
```

### Data Flow

```
Crosstable (cached in tournament.metadata or scraped fresh)
    │
    ├── computeStandings()           → rankings + tiebreaks
    ├── computePlayerStats() × N     → per-player W/D/L, TPR
    ├── computeStandingsAfterRound() → rank progression (charts)
    ├── runSimulation()              → outcome probabilities
    └── applyHypotheticalResults()   → modified crosstable → runSimulation()
```

---

## 6. API Reference

All endpoints are Next.js API routes under `/app/api/`. Auth via NextAuth session cookies.

### Tournaments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/tournaments` | — | List tournaments (search, filter by status/country) |
| POST | `/api/tournaments/import` | Yes | Import tournament from chess-results.com URL |
| GET | `/api/tournaments/[id]` | — | Tournament detail with metadata |
| POST | `/api/tournaments/[id]/refresh` | Yes | Rescrape tournament data from source |
| GET | `/api/tournaments/[id]/crosstable` | — | Full crosstable (cached or scraped) |
| GET | `/api/tournaments/[id]/analytics` | — | Standings, player stats, rank progression, simulation |
| POST | `/api/tournaments/[id]/simulate` | — | What-if simulation with hypothetical results |
| GET | `/api/tournaments/[id]/snapshots` | — | Round-by-round standings snapshots |
| GET | `/api/tournaments/[id]/export/csv` | — | Export standings as CSV |
| GET | `/api/tournaments/[id]/export/pgn` | — | Export games as PGN |
| GET | `/api/tournaments/[id]/export/pdf` | — | Export tournament report as PDF |

### Players

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/players` | — | List players (search by name/FIDE ID, sort by rating) |
| GET | `/api/players/[id]` | — | Player profile with tournament history |
| POST | `/api/players/[id]/claim` | Yes | Claim player identity (pending approval) |
| GET | `/api/players/[id]/openings` | — | Opening statistics by ECO code |
| GET | `/api/players/compare` | — | Head-to-head comparison between two players |
| GET | `/api/players/chess-results-search` | — | Search chess-results.com for players |
| POST | `/api/players/bulk-import` | Yes | Bulk player import (API only) |

### Import

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/import/url` | Yes | Async import by URL (returns job ID) |
| POST | `/api/import/file` | Yes | Import from uploaded file |
| GET | `/api/import/jobs/[jobId]` | Yes | Check import job status |

### User

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET/POST | `/api/users/me/following/players` | Yes | Get/add followed players |
| GET/POST | `/api/users/me/following/tournaments` | Yes | Get/add bookmarked tournaments |
| GET/PATCH/DELETE | `/api/users/me/notifications` | Yes | Notification management |
| GET/PUT | `/api/users/me/preferences` | Yes | User preferences (theme, language, alerts) |

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Email/password registration |
| * | `/api/auth/[...nextauth]` | NextAuth handlers (signin, signout, callback, session) |

### Events

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/events` | SSE stream — subscribe to tournament updates (query: `tournamentIds`) |

---

## 7. Testing Strategy

### Unit Tests — Jest

Config: `jest.config.ts`. Run: `npm test`. **171 tests**, all passing.

Tests in `tests/unit/`:

| Test file | What it covers |
|---|---|
| `chess-results-scraper.test.ts` | HTML parsing for standings, pairings, player list, info page |
| `chess-results-provider.test.ts` | Scraper integration (crosstable, round detection) |
| `chess-results-player-search.test.ts` | External player search parsing |
| `chess-results-search-api.test.ts` | Search API endpoint logic |
| `bulk-import.test.ts` | Bulk player import pipeline |
| `elo.test.ts` | Expected score, K-factor, rating change, TPR |
| `tiebreaks.test.ts` | Buchholz, Sonneborn-Berger calculations |
| `standings.test.ts` | Rankings, tiebreak ordering, round truncation |
| `player-stats.test.ts` | W/D/L, color stats, score progression |
| `monte-carlo.test.ts` | Simulation convergence, deterministic results |
| `what-if.test.ts` | Hypothetical result injection, needs calculation |
| `title-badge.test.ts` | GM/IM/FM badge rendering |

Fixtures in `tests/fixtures/` — real HTML scraped from tournament `tnr1233866` (Rishon LeZion Summer Festival Blitz): standings, pairings rd1, player list, info page, crosstable.

### E2E Tests — Playwright

Config: `playwright.config.ts`. Run: `npm run test:e2e`. **9 spec files**, all passing.

| Spec file | Coverage |
|---|---|
| `navigation.spec.ts` | Header links, sidebar, breadcrumbs |
| `tournaments-list.spec.ts` | Tournament list page, search, filters |
| `tournament-detail.spec.ts` | Tabs (standings, pairings, crosstable), export buttons |
| `tournament-import.spec.ts` | URL import flow, validation |
| `players.spec.ts` | Player list, search, pagination |
| `player-tournament-page.spec.ts` | Player journey tabs, stats, charts |
| `auth-pages.spec.ts` | Sign in, register forms |
| `api-endpoints.spec.ts` | API response validation |
| `responsive.spec.ts` | Mobile layout, responsive breakpoints |

### Testing Rules

- Every code change must pass `npm test` + `npm run test:e2e` before commit
- New UI flows require new e2e tests
- Fixtures use real HTML — no mocked data for scraper tests

---

## 8. Future Roadmap

Ordered by foundation-first — earlier items unlock later ones.

### Tier 1 — Complete What's Started

- **UX Overhaul** — compact Lichess-style tables, breadcrumbs, favorites system, navigation drill-down. Already planned in `docs/plans/2026-02-11-ux-overhaul-feature-expansion.md` (4 phases, 14 steps)
- **Live Auto-Refresh** — auto-poll active tournaments instead of manual refresh. SSE infrastructure exists, needs scheduler integration
- **Email Notifications** — verification emails, game result alerts, round start alerts. Schema ready (`UserPreference` has all toggles), needs email provider (Resend/SendGrid)
- **Push Notifications** — web push via service worker. `pushNotifications` field exists on `UserPreference`
- **Admin Dashboard** — sync history, scraping job monitor, data quality manual overrides. Backend exists (`DataSyncLog`, `ScrapingJob`, manual override system), needs UI

### Tier 2 — Expand Data Sources

- **Multi-Source Support** — import from FIDE ratings list, Lichess tournaments, chess.com events. Architecture supports it (`sourceType` field on Tournament, parser pattern is pluggable)
- **PGN Import** — populate `Game`/`Move` models from PGN files. Enables move-by-move game viewer. `Move` schema is fully designed with all fields
- **Tournament Search** — search chess-results.com (and future sources) from within the app, not just import by URL
- **Player Alias Management** — UI to merge/link duplicate players across sources. `PlayerAlias` model exists, needs management interface

### Tier 3 — Advanced Analytics

- **Engine Analysis** — fill `evaluationCp`/`bestMove` fields via Stockfish WASM. Show accuracy scores, blunder charts, critical moment detection. `Move` model has all evaluation fields ready
- **Opening Explorer** — click any ECO code to see all games with that opening, win rates by rating band, common continuations
- **Tournament Comparison Chart** — overlay multiple players' rating/rank progression across tournaments over time
- **Head-to-Head Deep Dive** — expand `/compare` with opening tendencies, time control breakdowns, rating trajectory overlap

### Tier 4 — Platform

- **Share Links** — shareable URLs for specific standings states, player comparisons, simulation snapshots. Encode state in URL params or generate short links
- **Mobile App** — PWA with offline support + push notifications, or React Native wrapper for native experience
