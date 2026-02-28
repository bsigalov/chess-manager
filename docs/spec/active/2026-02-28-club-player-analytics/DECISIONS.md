---
document_type: decisions
project_id: SPEC-2026-02-28-001
---

# Club Player Analytics — Architecture Decision Records

## ADR-001: Player-Focused Drill-Down (not Dashboard Grid)

**Date**: 2026-02-28
**Status**: Accepted

### Context
Three UI approaches considered: tabbed single page, Grafana-style dashboard grid, or player-focused drill-down. User wants to start from a player and explore outward.

### Decision
Build as `/players/[id]/analytics` — a per-player page with comparison overlays via filter chips.

### Consequences
**Positive**: Natural entry point (select yourself), deep per-player analytics, clean URL structure
**Negative**: Must load comparison data dynamically (extra API calls), no "overview" of all players at once

### Alternatives Considered
1. **Dashboard grid**: Good for overview but loses player-centric focus
2. **Tabbed single page**: Gets cluttered with all metrics + comparisons

---

## ADR-002: Filter Chips for Comparison Groups

**Date**: 2026-02-28
**Status**: Accepted

### Context
User wants multiple comparison modes: club, age, experience, opponents, tournament. Need a UX pattern that supports N modes without overwhelming.

### Decision
Horizontal chip bar below player card. Each chip toggles a comparison group. Multiple chips can be active simultaneously (union of player sets).

### Consequences
**Positive**: Discoverable, composable (combine filters), familiar pattern
**Negative**: Could get noisy with many comparisons active; need player count limit

---

## ADR-003: File-Based Cache (not Prisma) for Israeli Data

**Date**: 2026-02-28
**Status**: Accepted

### Context
Israeli chess federation data comes from scraping chess.org.il. Could store in Prisma DB or file cache.

### Decision
Continue using `.cache/` directory with JSON files. Per-player deep data cached as `.cache/player-{id}-deep.json`.

### Consequences
**Positive**: Simple, no migration needed, easy to inspect/debug, works without DB
**Negative**: No indexing or querying — comparison group resolution must read multiple files
**Mitigation**: Club-level cache already groups players; most lookups are by ID

### Alternatives Considered
1. **Prisma DB**: Better for queries but requires schema changes and migration for external data
2. **Redis**: Overkill for local dev, adds infrastructure dependency

---

## ADR-004: Weighted Linear Regression for Predictions

**Date**: 2026-02-28
**Status**: Accepted

### Context
Need to predict future ratings. Options range from simple averages to ML models.

### Decision
Use weighted linear regression with exponential decay (recent data weighted more). Show 95% confidence bands.

### Consequences
**Positive**: Simple, interpretable, works with sparse data (3+ points), confidence bands show uncertainty
**Negative**: Assumes linear trend (misses plateaus, step changes)
**Mitigation**: Classify momentum (rising/declining/plateau) separately; flag low R² predictions

### Alternatives Considered
1. **Simple average**: Too naive, misses trends
2. **ARIMA/LSTM**: Overkill for 30-100 data points, hard to interpret
3. **Glicko**: Requires game-by-game data and is rating system, not forecasting

---

## ADR-005: Progressive Data Depth (Tier 1 → 2 → 3)

**Date**: 2026-02-28
**Status**: Accepted

### Context
Full scraping (profile + tournaments + games) takes ~60s per player. Can't block page load.

### Decision
Three-tier progressive loading:
- **Tier 1** (instant): Rating history from club cache → basic analytics
- **Tier 2** (on demand): Tournament history → tournament gain chart, performance rating
- **Tier 3** (on demand): Individual games → win rate by band, H2H records

UI shows partial analytics immediately, with "Scrape for more" buttons.

### Consequences
**Positive**: Page loads fast, user controls data depth, no wasted scraping
**Negative**: Some metrics unavailable until deep scrape, UX complexity of partial states
