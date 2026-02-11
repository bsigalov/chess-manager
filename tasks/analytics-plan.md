# Chess Tournament Manager — Full Analytics Plan

## Context

The app has basic tournament import/display from chess-results.com but lacks analytics. The goal is to build **sports-analytics-grade features**: win probabilities, Monte Carlo simulations, what-if scenarios, crosstable views, and player performance analytics. Reference tournament: `tnr1323708` (20-player Swiss, 9 rounds).

**User choices**: Chart.js + react-chartjs-2 for charts, server-side Monte Carlo API (50k+ iterations).

---

## Phase 1: Crosstable Scraping (Foundation)

Everything depends on rich per-player, per-round data. The crosstable page (`art=4`) encodes cells like `"13w1"` (played #13 as white, won).

### Files to modify:
- **`lib/scrapers/chess-results-parser.ts`** — Add `parseCrosstableCell(cell)` helper
- **`lib/scrapers/chess-results.ts`** — Add `scrapeCrosstable(tournamentId)` returning `CrosstableEntry[]`
- **`lib/types/tournament.ts`** *(new)* — Shared types: `CrosstableEntry`, `PlayerRoundResult`
- **`app/api/tournaments/[id]/crosstable/route.ts`** *(new)* — GET endpoint, scrapes & caches in `tournament.metadata`
- **`app/api/tournaments/import/route.ts`** — Also scrape crosstable during import

### Key type:
```ts
interface CrosstableEntry {
  startingRank: number;
  name: string;
  rating: number | null;
  title: string | null;
  points: number;
  roundResults: {
    round: number;
    opponentRank: number | null; // null for BYE
    color: 'w' | 'b' | null;
    score: number; // 1, 0.5, 0
    isForfeit: boolean;
    isBye: boolean;
  }[];
}
```

---

## Phase 2: Analytics Engine (`lib/analytics/`)

### `lib/analytics/elo.ts`
- `expectedScore(ratingA, ratingB)` — FIDE formula
- `winDrawLossProbability(whiteElo, blackElo)` — W/D/L split (draw rate model ~33% at equal Elo)
- `performanceRating(results[])` — TPR calculation

### `lib/analytics/tiebreaks.ts`
- `buchholz(playerRank, crosstable)` — sum of opponents' scores
- `sonnebornBerger(playerRank, crosstable)`

### `lib/analytics/player-stats.ts`
- W/D/L by color, performance rating, score trajectory, avg opponent rating, color balance

### `lib/analytics/standings.ts`
- `computeStandings(crosstable)` — derive standings with all tiebreaks from raw crosstable

---

## Phase 3: Monte Carlo Simulation (Server-Side)

### `lib/analytics/monte-carlo.ts`
Core simulation engine:
- For each remaining round: group by score, pair top-half vs bottom-half (Swiss approximation)
- For each pairing: Elo expected score → random roll
- After all rounds: compute final standings with tiebreaks
- Aggregate across 50,000 iterations

### `lib/analytics/what-if.ts`
- `applyHypotheticalResults(crosstable, hypotheticals)` — inject manual results
- `whatDoesPlayerNeed(playerRank, crosstable, totalRounds, targetPosition)` — human-readable answer

### API Routes:
- **`app/api/tournaments/[id]/simulate/route.ts`** *(new)* — POST `{ iterations, hypotheticals? }` → `SimulationResult`
- **`app/api/tournaments/[id]/analytics/route.ts`** *(new)* — GET full analytics payload (probabilities, player stats, magic numbers)

### SimulationResult type:
```ts
interface SimulationResult {
  players: {
    startingRank: number;
    name: string;
    probFirst: number;
    probTop3: number;
    expectedPoints: number;
    pointsStdDev: number;
    positionDistribution: number[]; // probability of each finishing position
  }[];
}
```

---

## Phase 4: UI Components

### Charts (Chart.js + react-chartjs-2):
- **`components/features/win-probability-chart.tsx`** — Line chart: P(1st) per player across rounds
- **`components/features/score-trajectory-chart.tsx`** — Cumulative score lines per player
- **`components/ui/probability-bar.tsx`** — Horizontal stacked bar (W/D/L) for pairings

### Analytics views:
- **`components/features/crosstable-view.tsx`** — NxN matrix with color indicators
- **`components/features/player-detail-card.tsx`** — Performance, color stats, trajectory sparkline
- **`components/features/predictions-panel.tsx`** — Simulation results: bar chart + table
- **`components/features/what-if-panel.tsx`** — Set results for remaining rounds, recalculate
- **`components/features/magic-numbers.tsx`** — "X needs Y to clinch/is eliminated" cards

### Modify existing:
- **`app/tournaments/[id]/tournament-detail.tsx`** — Add tabs: Crosstable, Analytics, Predictions, What If
- **`components/features/standings-table.tsx`** — Add columns: Win%, Top3%, Perf, +/-, SOS
- **`components/features/pairings-view.tsx`** — Add W/D/L prediction bars per pairing

### npm install:
- `chart.js` + `react-chartjs-2`

---

## Phase 5: Schema Addition — Round Snapshots

```prisma
model RoundSnapshot {
  id           String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tournamentId String @map("tournament_id") @db.Uuid
  playerId     String @map("player_id") @db.Uuid
  round        Int
  pointsAfter  Float  @map("points_after")
  rankAfter    Int    @map("rank_after")
  performanceAfter Int? @map("performance_after")
  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  @@unique([tournamentId, playerId, round])
  @@map("round_snapshots")
}
```

Populated during import/refresh. Enables historical trend charts.

---

## Implementation Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
  |          |          |          |
  Scraping   Math       Sim API    UI
```

Each phase is independently testable. Phase 5 (snapshots) can be done anytime after Phase 1.

---

## Verification

1. Import tournament `tnr1323708`
2. `GET /api/tournaments/[id]/crosstable` → verify 20 players × 7 rounds of data
3. `GET /api/tournaments/[id]/analytics` → verify probabilities sum to ~100%
4. `POST /api/tournaments/[id]/simulate` with hypothetical results → verify standings change
5. UI: all 4 new tabs render, charts display, what-if recalculates
6. Mobile: verify responsive layout
7. Run `npm run typecheck` and `npm run lint`
