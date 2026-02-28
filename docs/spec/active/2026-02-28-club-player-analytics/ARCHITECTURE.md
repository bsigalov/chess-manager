---
document_type: architecture
project_id: SPEC-2026-02-28-001
version: 1.0.0
last_updated: 2026-02-28T12:00:00Z
status: draft
---

# Club Player Analytics — Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    /players/[id]/analytics                    │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Player   │  │  Analytics   │  │  Comparison Overlay   │ │
│  │  Summary  │  │  Charts      │  │  (filter chips)       │ │
│  │  Card     │  │  + Metrics   │  │                       │ │
│  └──────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
                      │ fetch
┌─────────────────────▼───────────────────────────────────────┐
│              API Routes (Next.js)                             │
│  /api/players/[id]/analytics     → computed metrics           │
│  /api/players/[id]/deep-scrape   → trigger Tier 2+3 scrape   │
│  /api/players/compare            → comparison group data      │
│  /api/players/search-il          → chess.org.il player search │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Data Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  .cache/     │  │  Prisma DB   │  │  chess.org.il    │  │
│  │  player-*.json  │  players      │  │  (live scrape)   │  │
│  │  (24h TTL)   │  │  tournaments │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Page Structure

### URL: `/players/[id]/analytics`

New page under existing player routes. The `[id]` is the Israeli chess federation ID.

```
┌─────────────────────────────────────────────────────────┐
│ ← Back to Players    Player Analytics                    │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │  PLAYER SUMMARY CARD                                │ │
│ │  יגור סטוליארסקי  Rating: 2169  Rank: #42          │ │
│ │  Age: 24  Club: צפריר הובר  FIDE: 2180             │ │
│ │  Velocity: +8.3/mo ↑  Momentum: Rising (peak: 2169) │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │  COMPARISON CHIPS                                    │ │
│ │  [My Club] [Age ±2y] [Similar Exp] [Opponents]      │ │
│ │  [Tournament ▾]  [Custom Player +]                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │  MAIN CHART (Rating History + Overlays)              │ │
│ │  ▶ Play  1x 2x 4x  ━━━━━●━━━━━━━  Feb 2026        │ │
│ │                                                      │ │
│ │  [Rating lines for selected player + comparisons]    │ │
│ │  [Prediction band shaded in gray]                    │ │
│ │  Height: 400px                                       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│ │  VELOCITY    │ │  MILESTONES  │ │  WIN RATE        │ │
│ │  +8.3 pts/mo │ │  2200: ~4mo  │ │  vs >2000: 35%  │ │
│ │  ▁▂▃▄▅▆▇    │ │  2400: ~28mo │ │  vs ±100: 52%   │ │
│ │  (sparkline) │ │              │ │  vs <1800: 78%   │ │
│ └──────────────┘ └──────────────┘ └──────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │  RATING GAIN PER TOURNAMENT (bar chart)             │ │
│ │  ▊ ▊ ▋ ▎ ▊ ▊ ▍ ▊ ▊ ▊  avg: +5.2                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │  COMPARISON TABLE (when chips active)               │ │
│ │  Player  Rating  Velocity  Momentum  Prediction     │ │
│ │  ...                                                │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Component Design

### Component 1: PlayerAnalyticsPage (`app/players/[id]/analytics/page.tsx`)
- **Purpose**: Page shell — fetches data, manages comparison state
- **State**: selectedPlayer, comparisonPlayers[], activeFilters[]
- **Data fetching**: SWR or fetch on mount + filter change

### Component 2: PlayerSummaryCard
- **Purpose**: Key stats at a glance
- **Props**: PlayerProfile + computed metrics (velocity, momentum)
- **Depends on**: lib/analytics/player-analytics.ts

### Component 3: ComparisonChips
- **Purpose**: Filter chip bar for selecting comparison groups
- **Chips**: My Club | Age ±2y | Similar Experience | Past Opponents | Tournament ▾ | Custom +
- **Events**: onFilterChange(filters) → triggers data fetch for comparison group
- **State**: activeFilters: Set<FilterType>

### Component 4: AnalyticsRatingChart (extends ClubRatingChart)
- **Purpose**: Main rating chart with prediction overlay
- **Features**: Play/pause animation, comparison overlays, prediction band
- **New**: Shaded prediction area (confidence band), regression line extension

### Component 5: MetricCards (Velocity, Milestones, WinRate)
- **Purpose**: Small stat cards below the main chart
- **Layout**: 3-column grid on desktop, stacked on mobile
- **Each card**: Number + trend indicator + sparkline or breakdown

### Component 6: TournamentGainChart
- **Purpose**: Bar chart of rating change per tournament
- **Data**: From Tier 2 scraped tournament data
- **Highlight**: Average line, color-code positive (green) / negative (red)

### Component 7: ComparisonTable
- **Purpose**: Tabular comparison when multiple players are selected
- **Columns**: Player, Rating, Velocity, Momentum, Prediction (3mo), Win Rate
- **Sorting**: Click column headers

## Data Design

### New Analytics Module: `lib/analytics/player-analytics.ts`

```typescript
interface PlayerAnalytics {
  // Rating trend
  velocity: number;            // points per month (last 12mo)
  velocitySeries: number[];    // monthly velocity values for sparkline
  momentum: 'rising' | 'declining' | 'plateau';
  peakRating: number;
  peakDate: Date;
  monthsSincePeak: number;

  // Predictions
  prediction3mo: { rating: number; low: number; high: number };
  prediction6mo: { rating: number; low: number; high: number };
  prediction12mo: { rating: number; low: number; high: number };
  milestones: { target: number; estimatedMonths: number | null }[];

  // Efficiency (requires Tier 2+3 data)
  avgRatingGainPerTournament: number | null;
  tournamentGains: { name: string; date: Date; gain: number }[] | null;
  winRateByBand: { band: string; games: number; wins: number; rate: number }[] | null;
}
```

### Cache Structure: `.cache/player-{israeliId}-deep.json`

Per-player deep cache containing Tier 2+3 data:

```json
{
  "timestamp": 1709136000000,
  "profile": { /* PlayerProfile */ },
  "ratingHistory": [ /* RatingEntry[] */ ],
  "tournaments": [ /* TournamentEntry[] */ ],
  "games": [ /* GameEntry[] */ ]
}
```

### Comparison Group Resolvers

| Filter | Data Source | Resolution |
|--------|-----------|------------|
| My Club | .cache/club-{id}.json | All players in same club |
| Age ±2y | Search chess.org.il by birth year range | Scrape + cache |
| Similar Experience | Rating history length comparison | Players with similar # of rating periods |
| Past Opponents | Player's Tier 3 game data | Unique opponent IDs |
| Tournament X | Prisma DB or chess.org.il | All participants in selected tournament |
| Custom | User picks from search | Individual player add |

## API Design

### GET `/api/players/[id]/analytics`
- **Input**: israeliId as path param
- **Process**: Read cached deep data → compute analytics
- **Response**: `{ profile, analytics: PlayerAnalytics, ratingHistory }`
- **Cache**: Computed analytics cached with source data

### POST `/api/players/[id]/deep-scrape`
- **Input**: israeliId, depth ('profile' | 'tournaments' | 'games')
- **Process**: Scrape chess.org.il, cache result
- **Response**: `{ status: 'complete', profile, tournaments?, games? }`
- **Note**: Long-running, returns streaming progress or polling

### GET `/api/players/compare`
- **Input**: Query params: `primaryId`, `filter` (club|age|experience|opponents|tournament), `filterValue?`
- **Process**: Resolve comparison group → return analytics for each
- **Response**: `{ primary: PlayerAnalytics, comparisons: PlayerAnalytics[] }`

### GET `/api/players/search-il`
- **Input**: Query param: `q` (name search)
- **Process**: Search chess.org.il player database
- **Response**: `{ results: { israeliId, name, rating, club }[] }`

## Prediction Algorithm

### Linear Regression with Exponential Weighting

```
Input: rating history points [(date, rating), ...]
  1. Convert dates to months-from-now (x values)
  2. Apply exponential weight: w_i = e^(-λ × months_ago), λ = 0.1
  3. Weighted least squares: minimize Σ w_i × (y_i - (mx_i + b))²
  4. Solve for m (slope) and b (intercept)
  5. Predict: future_rating = current_rating + m × months_forward
  6. Confidence: ±(1.96 × σ_residuals × √(1 + 1/n + ...))
```

### Momentum Classification
```
If velocity > 3 pts/mo  → 'rising'
If velocity < -3 pts/mo → 'declining'
Else                     → 'plateau'
```

### Milestone Estimation
```
months_to_target = (target - current_rating) / velocity
If velocity ≤ 0 → null (won't reach at current trend)
```

## Security Considerations
- Rate limit chess.org.il scraping (2s delays, respect robots.txt)
- No authentication needed (public player data)
- Sanitize player search input
- Cache files in .gitignored .cache/ directory
