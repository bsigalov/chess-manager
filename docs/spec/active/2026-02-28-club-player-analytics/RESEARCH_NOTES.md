---
document_type: research
project_id: SPEC-2026-02-28-001
last_updated: 2026-02-28T11:45:00Z
---

# Club Player Analytics — Research Notes

## Research Summary

Comprehensive analytics dashboard for Israeli chess players, inspired by tools like ChessGraphs.com, Lichess Insights, and the covidtrends animated visualization. Designed for a player-first experience with comparison capabilities.

## Existing Data Available

### Rating History (Already Cached)
- ~30-117 data points per player (monthly/quarterly snapshots over years)
- Format: `{ period: "DD/MM/YYYY", rating: number, recordedAt: ISO date }`
- 21 players cached for club 155 (צפריר הובר רחובות)

### Player Profiles (Already Cached)
- Israeli ID, name, birth year, Israeli rating, FIDE rating
- Club membership, card validity, Israeli rank

### Available via Scraping (Not Yet Cached)
| Tier | Data | Scrape Time | Use Cases |
|------|------|-------------|-----------|
| Tier 2: Tournaments | Name, date, games, points, perf rating, rating change | ~30s/player | Tournament performance trends, rating gain efficiency |
| Tier 3: Games | Opponent, color, result, opponent rating | ~60s/player | H2H records, win rate by strength, color stats |

### Prisma DB Players
Players imported from chess-results.com tournaments — different data source but overlappable via name matching or FIDE ID.

## Existing Analytics Functions (lib/analytics/)

| Module | Functions | Reusable For |
|--------|-----------|-------------|
| elo.ts | expectedScore(), kFactor(), ratingChange(), performanceRating(), winDrawLossProbability() | Predictions, efficiency |
| player-stats.ts | W/D/L stats, color stats, performance rating, score progression | Efficiency metrics |
| monte-carlo.ts | Win probability, expected points | Performance expectation |
| standings.ts | Rank, points, tiebreaks | Tournament context |

## Industry Reference

### ChessGraphs.com
- Rating history graphing for FIDE/USCF players
- Simple line chart with date range selector

### Lichess Insights
- Performance by opening, time control, opponent rating range
- Streaks, rating progression, game results breakdown

### ChessMonitor.com
- Cross-platform comparison (Chess.com + Lichess)
- Opening explorer, rating trends

### Covidtrends (aatishb.com)
- Animated time series with play/pause/scrub
- Already implemented in our club-rating-chart.tsx

## Prediction Approaches

### Linear Regression (Recommended for Phase 1)
- Fit `rating = slope × months + intercept` to recent 12 months
- Weight recent data more heavily (exponential decay)
- ±100-150 point confidence band for 3-month forecast
- Simple, interpretable, works with sparse data

### Milestone Prediction
- Given slope, solve for `(target_rating - current) / slope = months`
- Show "estimated time to reach X rating"
- Only meaningful when slope > 0

### Peer Crossing Prediction
- Two players' regression lines: solve for intersection
- "Player A will overtake Player B in ~X months at rating ~Y"

## Key Metrics Identified

| Metric | Formula | Interpretation |
|--------|---------|---------------|
| Rating Velocity | Δrating / Δmonths (recent 12mo) | Points gained per month |
| Career Momentum | Current vs Peak, months since peak | Improving/declining/plateau |
| Win Rate by Band | Wins / games per opponent rating band (±100) | Strength against different levels |
| Rating Gain/Tournament | Avg rating change per tournament | Improvement efficiency |
| Performance vs Expected | Perf rating - actual rating | Over/underperformance |

## Sources
- ChessGraphs.com, ChessMonitor.com, Chess-Analysis.org
- Wikipedia: Performance Rating, Elo Rating System
- aatishb.com/covidtrends — animation pattern
- FIDE rating calculation documentation
