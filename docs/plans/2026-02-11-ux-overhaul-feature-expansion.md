# Chess Manager UX Overhaul & Feature Expansion

## Context

The Chess Tournament Manager has a solid data model and functional pages, but the UX needs improvement: tables are too sparse/wide, favorite players are hard to find, navigation lacks drill-down context, and several high-value features are missing. This plan addresses all 4 areas the user identified.

---

## Phase 1: UX / Data Density (Lichess-style)

**Goal**: Compact, visually rich tables with better color coding.

### 1.1 Base table component
- **`components/ui/table.tsx`**: Change `TableHead` padding to `h-9 px-2 py-1.5`, `TableCell` to `px-2 py-1.5`, add zebra striping `even:bg-muted/20`, uppercase header text `text-xs uppercase tracking-wider`

### 1.2 StandingsTable
- **`components/features/standings-table.tsx`**: Add `max-w-3xl` wrapper, `tabular-nums` on numeric cells, gold/silver/bronze rank badges for top 3, performance color (green if perf > rating, red if below), hide Fed + Perf columns on mobile

### 1.3 PairingsView
- **`components/features/pairings-view.tsx`**: Reduce card padding `p-3` → `p-2`, add result-colored left border (`border-l-2 border-l-emerald-400` for win, etc.)

### 1.4 PlayerProfile tables
- **`components/features/player-profile.tsx`**: Apply compact padding, performance color coding

### 1.5 Tournament detail Players tab
- **`app/tournaments/[id]/tournament-detail.tsx`** (lines 327-362): Replace raw `<table>` with Shadcn `Table` component or tighten padding

---

## Phase 2: Navigation & Drill-Down

**Goal**: Contextual navigation — stay inside tournament scope, breadcrumbs everywhere.

### 2.1 Fix link targets in tournament context
- **`components/features/standings-table.tsx`** (line 106): Change to `/tournaments/${tournamentId}/players/${playerId}` when `tournamentId` prop exists
- **`components/features/pairings-view.tsx`** (line 62): Thread `tournamentId` into `PlayerName`, same link change
- **`app/tournaments/[id]/tournament-detail.tsx`** (line 347): Fix Players tab links

### 2.2 Breadcrumbs
- **New: `components/layout/breadcrumbs.tsx`**: Simple component taking `{ label, href? }[]` array
- Add to: tournament detail, player profile, tournament player view, game detail pages

### 2.3 Clickable game results
- **`components/features/pairings-view.tsx`**: Wrap result span in Link to `/tournaments/${tournamentId}/games/${gameId}`
- **API**: Include `game.id` in pairings response from `/api/tournaments/[id]/route.ts`
- **New: `app/tournaments/[id]/games/[gameId]/page.tsx`**: Basic game viewer (PGN movetext, opening, result)

### 2.4 Clickable crosstable cells
- **`components/features/crosstable-view.tsx`**: Link result cells to game detail or head-to-head page

---

## Phase 3: Favorites / Followed Players

**Goal**: Followed players visible everywhere with zero extra effort.

### 3.1 FollowedPlayers context provider
- **New: `components/providers/followed-players-provider.tsx`**: React context fetching followed player IDs + basic info on mount (authenticated only)
- **New: `app/api/users/me/following/route.ts`**: Lightweight endpoint returning `{ players: [{ id, name, title, rating, latestResult }] }`
- Wrap in `app/layout.tsx` inside session provider

### 3.2 Highlight in tournament views (A)
- **`standings-table.tsx`**: Use `useFollowedPlayers()`, apply `bg-amber-50/50 dark:bg-amber-950/20` + star icon on followed rows
- **`pairings-view.tsx`**: Left border highlight on cards with followed players
- **`crosstable-view.tsx`**: Row background highlight

### 3.3 Header favorites dropdown (B)
- **New: `components/features/favorites-dropdown.tsx`**: Popover triggered by Heart icon showing followed players with name, rating, latest result
- **`components/layout/header.tsx`** (line 65): Add Heart icon button next to NotificationBell

### 3.4 Filter toggle (C)
- **`app/tournaments/[id]/tournament-detail.tsx`**: Add `showOnlyFollowed` state, pass to StandingsTable and PairingsView
- Both components filter data when toggle is on

### 3.5 Home page "My Players" section (D)
- **New: `components/features/my-players-section.tsx`**: Client component showing followed players' recent results
- **`app/page.tsx`**: Add section (only renders for authenticated users)

---

## Phase 4: New Features

### 4a. Tiebreak Details
- **`components/features/standings-table.tsx`**: Add optional Buchholz + Sonneborn-Berger columns (hidden on mobile)
- **`app/api/tournaments/[id]/route.ts`**: Compute tiebreaks using existing `lib/analytics/tiebreaks.ts` and include in standings response
- Reuse: `lib/analytics/tiebreaks.ts` (buchholz, sonnebornBerger functions)

### 4b. Opening Stats
- **New: `app/api/players/[id]/openings/route.ts`**: Group games by ecoCode, compute win/draw/loss per opening
- **New: `components/features/opening-stats.tsx`**: Table with ECO, name, games count, stacked win/draw/loss bar
- **`components/features/player-profile.tsx`**: Add "Openings" tab, lazy-load on activation

### 4c. Tournament Search/Discovery
- **`app/api/tournaments/route.ts`**: Add query params: `q`, `country`, `status`, `dateFrom`, `dateTo`, `playerId`
- **New: `components/features/tournament-search.tsx`**: Search input + filter dropdowns, debounced fetch, URL param sync
- **`app/tournaments/page.tsx`**: Integrate search component

### 4d. Share Links
- **`app/tournaments/[id]/tournament-detail.tsx`**: Sync tab + round selection to URL search params via `useSearchParams()`
- **New: `components/features/copy-link-button.tsx`**: Copies current URL, shows toast
- Add to tournament detail header and player profile header

### 4e. Head-to-Head Comparison
- **New: `app/api/players/compare/route.ts`**: Query pairings between two players, return games + aggregate stats
- **New: `app/compare/page.tsx`**: Two player selectors, H2H summary bar, game list
- Link from crosstable cells and player profile ("Compare" button)

### 4f. Tournament Comparison Chart
- **New: `components/features/tournament-comparison-chart.tsx`**: Bar chart (performance) + line chart (rating) across tournaments
- **`components/features/player-profile.tsx`**: Add chart toggle above tournaments table
- Uses same chart library as existing `score-trajectory-chart.tsx`

---

## Implementation Order

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 1 | UX table density (Phase 1) | Low | None |
| 2 | Fix link targets (2.1) | Low | None |
| 3 | Breadcrumbs (2.2) | Low | None |
| 4 | Share links + URL sync (4d) | Low | None |
| 5 | Tiebreak details (4a) | Low | Phase 1 |
| 6 | FollowedPlayers provider (3.1) | Medium | None |
| 7 | Highlight + filter (3.2, 3.4) | Medium | Step 6 |
| 8 | Header dropdown (3.3) | Medium | Step 6 |
| 9 | Home page section (3.5) | Medium | Step 6 |
| 10 | Game detail page (2.3, 2.4) | Medium | Step 2 |
| 11 | Tournament search (4c) | Medium | None |
| 12 | Opening stats (4b) | Medium | None |
| 13 | Head-to-head (4e) | Medium | None |
| 14 | Tournament comparison chart (4f) | Medium | None |

Steps 1-5 can be done first as quick wins. Steps 6-9 form the favorites block. Steps 10-14 are independent features.

---

## New Files Summary

| File | Purpose |
|------|---------|
| `components/layout/breadcrumbs.tsx` | Breadcrumb navigation |
| `components/providers/followed-players-provider.tsx` | Favorites context |
| `components/features/favorites-dropdown.tsx` | Header favorites popover |
| `components/features/my-players-section.tsx` | Home page favorites |
| `components/features/copy-link-button.tsx` | Share link button |
| `components/features/tournament-search.tsx` | Search/filter UI |
| `components/features/opening-stats.tsx` | Player opening stats |
| `components/features/tournament-comparison-chart.tsx` | Multi-tournament chart |
| `app/tournaments/[id]/games/[gameId]/page.tsx` | Game detail page |
| `app/compare/page.tsx` | Head-to-head page |
| `app/api/users/me/following/route.ts` | Favorites API |
| `app/api/players/[id]/openings/route.ts` | Opening stats API |
| `app/api/players/compare/route.ts` | H2H comparison API |

## Verification

After each phase:
1. `npm run typecheck` — no TypeScript errors
2. `npm run lint` — no linting issues
3. `npm run dev` — visual check that tables are compact, links work, highlights appear
4. Test favorites flow: follow a player → verify highlight in tournament → verify header dropdown → verify home page section
5. Test share links: change tab/round → copy URL → paste in new tab → verify same state loads
6. Test search: filter tournaments by name, country, status
7. Test new pages: /compare, game detail, opening stats tab
