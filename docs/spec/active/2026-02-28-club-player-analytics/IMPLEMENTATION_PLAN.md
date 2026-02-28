---
document_type: implementation_plan
project_id: SPEC-2026-02-28-001
version: 1.0.0
last_updated: 2026-02-28T12:00:00Z
status: draft
estimated_effort: ~3-4 days
---

# Club Player Analytics — Implementation Plan

## Overview

4-phase implementation building from data layer up to UI. Each phase is independently testable and delivers visible value.

## Phase Summary

| Phase | Name | Tasks | Key Deliverables |
|-------|------|-------|-----------------|
| 1 | Analytics Engine | 3 tasks | player-analytics.ts, prediction module, per-player cache |
| 2 | API Routes | 3 tasks | /analytics, /deep-scrape, /compare endpoints |
| 3 | Core UI | 4 tasks | Analytics page, summary card, main chart, metric cards |
| 4 | Comparison & Polish | 4 tasks | Filter chips, comparison overlay, tournament gain chart, comparison table |

---

## Phase 1: Analytics Engine

**Goal**: Pure computation layer — no UI, fully testable with unit tests.

### Task 1.1: Per-Player Deep Cache

- **File**: `lib/cache/player-cache.ts`
- **Description**: Extend the existing club-cache pattern for individual player deep data (profile + tournaments + games)
- **Interface**:
  ```typescript
  getCachedPlayerDeep(israeliId: number): DeepPlayerData | null
  setCachedPlayerDeep(israeliId: number, data: DeepPlayerData): void
  ```
- **Cache file**: `.cache/player-{israeliId}-deep.json`
- **TTL**: 24 hours (same as club cache)
- **Acceptance Criteria**:
  - [ ] Read/write deep player data to .cache/
  - [ ] TTL expiry works correctly
  - [ ] Handles missing/corrupt files gracefully

### Task 1.2: Player Analytics Computation

- **File**: `lib/analytics/player-analytics.ts`
- **Description**: Compute all analytics metrics from rating history + optional tournament/game data
- **Functions**:
  - `computeVelocity(history: RatingEntry[], windowMonths = 12): number` — points per month
  - `computeVelocitySeries(history: RatingEntry[]): number[]` — monthly velocity for sparkline
  - `classifyMomentum(history: RatingEntry[]): 'rising' | 'declining' | 'plateau'`
  - `findPeakRating(history: RatingEntry[]): { rating: number; date: Date }`
  - `computeWinRateByBand(games: GameEntry[]): WinRateBand[]`
  - `computeTournamentGains(tournaments: TournamentEntry[]): TournamentGain[]`
  - `computeFullAnalytics(data: DeepPlayerData): PlayerAnalytics`
- **Acceptance Criteria**:
  - [ ] Velocity calculation matches manual calculation
  - [ ] Momentum classification correct for rising/declining/plateau
  - [ ] Win rate bands correct for sample game data
  - [ ] Handles empty/sparse data gracefully (returns nulls, not errors)

### Task 1.3: Rating Prediction Module

- **File**: `lib/analytics/prediction.ts`
- **Description**: Linear regression with exponential weighting for rating forecasting
- **Functions**:
  - `predictRating(history: RatingEntry[], monthsForward: number): Prediction`
  - `predictMilestone(history: RatingEntry[], targetRating: number): number | null`
  - `predictCrossing(playerA: RatingEntry[], playerB: RatingEntry[]): CrossingPrediction | null`
  - `weightedLinearRegression(points: {x: number, y: number}[], weights: number[]): { slope: number, intercept: number, r2: number }`
- **Prediction interface**:
  ```typescript
  interface Prediction {
    rating: number;
    low: number;   // 95% confidence lower bound
    high: number;  // 95% confidence upper bound
    slope: number; // monthly rate of change
    r2: number;    // regression fit quality
  }
  ```
- **Acceptance Criteria**:
  - [ ] Linear regression produces correct slope for known data
  - [ ] Confidence bands widen with forecast distance
  - [ ] Milestone returns null for declining/plateau trends
  - [ ] Crossing prediction finds correct intersection month
  - [ ] Works with as few as 3 data points (minimum)

### Phase 1 Exit Criteria
- [ ] All analytics functions have unit tests
- [ ] `npm test` passes with new tests
- [ ] Functions work with real cached data from club 155

---

## Phase 2: API Routes

**Goal**: Expose analytics via API endpoints. Deep scraping with progress.

### Task 2.1: Analytics API Route

- **File**: `app/api/players/[id]/analytics/route.ts`
- **Description**: Compute and return player analytics
- **Logic**:
  1. Check `.cache/player-{id}-deep.json` for cached deep data
  2. If no deep data, fall back to club cache (rating history only)
  3. Compute analytics via `computeFullAnalytics()`
  4. Return profile + analytics + ratingHistory
- **Response**: `{ profile, analytics: PlayerAnalytics, ratingHistory, hasDeepData: boolean }`
- **Acceptance Criteria**:
  - [ ] Returns analytics from cached data
  - [ ] Gracefully handles missing deep data (returns partial analytics)
  - [ ] Response < 200ms from cache

### Task 2.2: Deep Scrape API Route

- **File**: `app/api/players/[id]/deep-scrape/route.ts`
- **Description**: Trigger deep scraping of a player's tournaments + games
- **Logic**:
  1. Accept POST with `{ depth: 'tournaments' | 'games' | 'full' }`
  2. Create new CookieSession, scrape requested data
  3. Cache result in `.cache/player-{id}-deep.json`
  4. Return complete data
- **Note**: This is long-running (~30-60s). Client polls or uses streaming.
- **Acceptance Criteria**:
  - [ ] Scrapes tournament history correctly
  - [ ] Scrapes game history correctly
  - [ ] Caches result for future reads
  - [ ] Returns error on scrape failure (doesn't hang)

### Task 2.3: Comparison API Route

- **File**: `app/api/players/compare/route.ts`
- **Description**: Resolve a comparison group and return analytics for each player
- **Query params**: `primaryId`, `filter` (club|age|experience|opponents|tournament), `filterValue?`
- **Resolution logic per filter**:
  - `club`: Read from club cache, return all players
  - `age`: Filter club cache by birth year ±2
  - `experience`: Filter by similar rating history length
  - `opponents`: Read primary player's game data, extract unique opponent IDs, fetch their data
  - `tournament`: Query Prisma DB or scrape tournament participants
- **Response**: `{ primary: PlayerAnalytics, comparisons: { name, israeliId, analytics }[] }`
- **Acceptance Criteria**:
  - [ ] Each filter returns correct player set
  - [ ] Analytics computed for each comparison player
  - [ ] Handles missing data gracefully (skip players without data)

### Phase 2 Exit Criteria
- [ ] All API routes return valid JSON
- [ ] curl tests pass for each endpoint
- [ ] Deep scrape works for at least 3 test players

---

## Phase 3: Core UI

**Goal**: Player analytics page with summary, chart, and metrics.

### Task 3.1: Analytics Page Shell

- **File**: `app/players/[id]/analytics/page.tsx`
- **Description**: Client page that fetches analytics and renders sub-components
- **State management**: useState for player data, comparison players, active filters
- **Loading**: Skeleton UI while fetching
- **Error**: Retry button on failure
- **Layout**: Responsive single-column, components stacked vertically
- **Acceptance Criteria**:
  - [ ] Page loads at /players/{israeliId}/analytics
  - [ ] Shows loading skeleton, then data
  - [ ] URL works for any valid Israeli player ID
  - [ ] "Deep scrape" button visible when hasDeepData is false

### Task 3.2: Player Summary Card

- **File**: `components/features/player-summary-card.tsx`
- **Description**: Compact card showing key player stats
- **Content**: Name, rating (with rank), age, club, FIDE rating, velocity arrow, momentum badge
- **Velocity display**: Number + colored arrow (↑ green / ↓ red / → gray) + sparkline
- **Momentum display**: Badge with color (rising=green, declining=red, plateau=yellow)
- **Acceptance Criteria**:
  - [ ] All fields displayed correctly
  - [ ] Handles missing data (FIDE rating, birth year) with "—"
  - [ ] Responsive on mobile
  - [ ] Velocity sparkline renders correctly

### Task 3.3: Analytics Rating Chart (Enhanced)

- **File**: `components/features/analytics-rating-chart.tsx`
- **Description**: Enhanced version of ClubRatingChart with prediction overlay
- **New features**:
  - Shaded prediction band (gray area extending from last data point)
  - Regression line (dashed) extending into future
  - Milestone markers on y-axis (horizontal dashed lines at 1600, 1800, 2000)
  - Comparison player lines (added dynamically when filters active)
  - Zoom/pan support (optional, via chartjs-plugin-zoom)
- **Reuses**: Color palette, play/pause controls, time axis from ClubRatingChart
- **Acceptance Criteria**:
  - [ ] Shows player's rating history as main line
  - [ ] Prediction band extends 3-12 months forward
  - [ ] Milestone lines visible when in range
  - [ ] Comparison overlays toggle on/off

### Task 3.4: Metric Cards

- **Files**: `components/features/velocity-card.tsx`, `milestone-card.tsx`, `winrate-card.tsx`
- **Description**: Three small stat cards in a grid below the chart
- **Velocity Card**: Current velocity number + sparkline of monthly velocities
- **Milestone Card**: Table of target ratings with estimated months
- **Win Rate Card**: Horizontal bar chart of win rate by opponent band (requires deep data)
- **Acceptance Criteria**:
  - [ ] Cards render correctly with real data
  - [ ] Win rate card shows "Scrape games for detailed stats" when no deep data
  - [ ] Responsive 3-col → 1-col on mobile

### Phase 3 Exit Criteria
- [ ] Page renders with real player data
- [ ] All components pass visual review
- [ ] E2E test: navigate to /players/{id}/analytics, verify content loads

---

## Phase 4: Comparison & Polish

**Goal**: Filter chips, comparison overlay, tournament efficiency chart.

### Task 4.1: Comparison Filter Chips

- **File**: `components/features/comparison-chips.tsx`
- **Description**: Horizontal bar of clickable chips for selecting comparison groups
- **Chips**: My Club | Age ±2y | Similar Experience | Past Opponents | Tournament ▾ | + Custom
- **Behavior**:
  - Click chip → fetch comparison group from API → overlay on chart
  - Click again → deactivate filter → remove overlay
  - "Tournament ▾" opens dropdown of player's recent tournaments
  - "+ Custom" opens player search dialog
- **Acceptance Criteria**:
  - [ ] Chips toggle on/off visually
  - [ ] Activating a chip fetches comparison data
  - [ ] Multiple chips can be active simultaneously (union of groups)
  - [ ] Loading indicator while fetching

### Task 4.2: Comparison Overlay Integration

- **Description**: Wire ComparisonChips to AnalyticsRatingChart
- **Logic**: When chips are active, add comparison players' rating histories as additional datasets on the chart
- **Player toggle**: Individual comparison players can be shown/hidden
- **Comparison table**: Show summary table below chart when comparisons active
- **Acceptance Criteria**:
  - [ ] Comparison lines appear on chart when chip activated
  - [ ] Individual players toggleable
  - [ ] Table shows: Name, Rating, Velocity, Momentum, 3mo Prediction
  - [ ] Peer crossing prediction highlighted if applicable

### Task 4.3: Tournament Gain Chart

- **File**: `components/features/tournament-gain-chart.tsx`
- **Description**: Bar chart showing rating change per tournament
- **Data**: From Tier 2 tournament data (requires deep scrape)
- **Features**:
  - Vertical bars, green for positive, red for negative
  - Horizontal average line
  - Hover tooltip: tournament name, date, games, points, rating change
  - X-axis: tournament dates (chronological)
- **Acceptance Criteria**:
  - [ ] Correct positive/negative coloring
  - [ ] Average line positioned correctly
  - [ ] Handles 0+ tournaments gracefully

### Task 4.4: Polish & Navigation

- **Description**: Final integration, navigation links, middleware updates
- **Tasks**:
  - Add "Analytics" link on player profile page
  - Add /players/[id]/analytics to middleware public routes
  - Add breadcrumb navigation on analytics page
  - Ensure all loading/error states are polished
  - Mobile responsive pass
- **Acceptance Criteria**:
  - [x] Can navigate to analytics from player profile
  - [x] Breadcrumbs work: Players > Player Name > Analytics
  - [x] No auth issues (public route)
  - [x] Mobile layout clean

### Phase 4 Exit Criteria
- [ ] All comparison modes work (club, age, experience, opponents, tournament)
- [ ] Full page E2E test passes
- [ ] `npm run test:e2e` all green

---

## Dependency Graph

```
Phase 1 (Analytics Engine):
  Task 1.1 (cache) ──┐
  Task 1.2 (analytics)─┼──→ Phase 2
  Task 1.3 (prediction)─┘

Phase 2 (API Routes):
  Task 2.1 (analytics API) ──┐
  Task 2.2 (deep-scrape API)──┼──→ Phase 3
  Task 2.3 (compare API) ─────┘

Phase 3 (Core UI):
  Task 3.1 (page shell) ──────┐
  Task 3.2 (summary card) ────┤
  Task 3.3 (chart) ───────────┼──→ Phase 4
  Task 3.4 (metric cards) ────┘

Phase 4 (Comparison & Polish):
  Task 4.1 (chips) ───────────┐
  Task 4.2 (overlay) ─────────┤
  Task 4.3 (tournament chart)──┤──→ Done
  Task 4.4 (polish) ──────────┘
```

## Testing Checklist

- [ ] Unit tests: player-analytics.ts (velocity, momentum, peak)
- [ ] Unit tests: prediction.ts (regression, milestones, crossing)
- [ ] Unit tests: player-cache.ts (read, write, TTL)
- [ ] API tests: /api/players/[id]/analytics returns valid data
- [ ] API tests: /api/players/[id]/deep-scrape completes
- [ ] API tests: /api/players/compare returns comparison groups
- [ ] E2E test: Navigate to /players/{id}/analytics, verify charts render
- [ ] E2E test: Click comparison chip, verify overlay appears
- [ ] E2E test: Mobile responsive check

## Launch Checklist

- [ ] All tests passing (`npm test` + `npm run test:e2e`)
- [ ] TypeScript clean (`npx tsc --noEmit`)
- [ ] No console errors in browser
- [ ] Middleware updated for new routes
- [ ] Navigation links added
- [ ] Cache directory in .gitignore
