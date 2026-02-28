---
document_type: requirements
project_id: SPEC-2026-02-28-001
version: 1.0.0
last_updated: 2026-02-28T12:00:00Z
status: draft
---

# Club Player Analytics — Product Requirements Document

## Executive Summary

Build a player-centric analytics dashboard that lets any Israeli chess player view their rating trends, efficiency metrics, predictions, and compare themselves against peers using multiple grouping strategies. The entry point is selecting a player, then drilling down into analytics and comparisons via filter chips.

## Problem Statement

### The Problem
The current `/clubs/compare` page shows a nice animated rating chart but offers no analytical insight. Players can't answer questions like "Am I improving?", "How do I compare to peers my age?", "When will I reach 1800?", or "How efficient am I at converting games into rating points?"

### Impact
Club players (21 in צפריר הובר, ~4000+ in Israel) lack tools to understand their progress beyond raw rating numbers. Parents of youth players especially want trend analysis and projections.

### Current State
- Animated rating history chart exists (covidtrends-style) for club 155
- Rating data cached from chess.org.il (30-117 data points per player)
- Analytics functions exist in `lib/analytics/` (Elo, performance rating, etc.)
- No per-player dashboard, no predictions, no comparison tools

## Goals and Success Criteria

### Primary Goal
A player can select themselves, see their analytics dashboard, and compare against any meaningful peer group — all from one page.

### Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard loads | < 2s (cached data) | Lighthouse |
| Prediction accuracy | ±150 points at 3mo | Back-test against historical data |
| Comparison groups | 6+ filter options | Feature checklist |
| Data freshness | 24h cache, on-demand refresh | Cache TTL |

### Non-Goals
- Real-time live tournament tracking (separate feature)
- PGN analysis / move-level analytics (too deep for this scope)
- FIDE rating calculations (Israeli rating only for Phase 1)
- Mobile app (responsive web is sufficient)

## User Analysis

### Primary Users
- **Club players**: Want to track their own progress and compare with clubmates
- **Youth player parents**: Want to see if their child is improving, milestone projections
- **Club coaches**: Want to identify talent, compare students

### User Stories

1. As a club player, I want to select myself and see my rating trend, velocity, and momentum so I can understand if I'm improving
2. As a club player, I want to see predictions for when I'll reach my next rating milestone so I can set goals
3. As a player, I want to compare my progress against peers who started at a similar rating/time so I can benchmark myself
4. As a parent, I want to see my child's rating trajectory and predicted rating in 6 months
5. As a player, I want to see my win rate against stronger/weaker opponents so I can identify weaknesses
6. As a player, I want to compare against my past opponents to see how I stack up
7. As a coach, I want to compare all club members' improvement rates to identify rising talent

## Functional Requirements

### Must Have (P0)

| ID | Requirement | Acceptance Criteria |
|----|------------|---------------------|
| FR-001 | Player selector — search/select any player from Israeli chess federation | Typeahead search, shows name + rating + club |
| FR-002 | Rating trend chart — interactive time series of player's Israeli rating | Date range selector, responsive, shows data points |
| FR-003 | Rating velocity metric — points gained/lost per month over last 12 months | Displayed as number + trend arrow + sparkline |
| FR-004 | Career momentum indicator — current vs peak, improving/declining/plateau | Visual indicator (green/yellow/red) + months since peak |
| FR-005 | Rating trajectory prediction — linear regression forecast with confidence band | 3/6/12 month predictions, shaded confidence area on chart |
| FR-006 | Milestone prediction — "When will I reach X?" | Shows estimated months to reach 1600/1800/2000/custom |
| FR-007 | Comparison filter chips — select peer groups for overlay | Chips: My Club, Same Age (±2y), Similar Experience, Past Opponents, Tournament X |
| FR-008 | Comparison overlay — selected group's ratings overlaid on player's chart | Different colors per comparison player, toggle individual players |
| FR-009 | Player summary card — key stats at a glance | Rating, rank, age, club, FIDE rating, velocity, momentum |
| FR-010 | Full-depth data scraping — tournaments + games from chess.org.il | Cached per player, on-demand refresh, progress indicator |

### Should Have (P1)

| ID | Requirement | Acceptance Criteria |
|----|------------|---------------------|
| FR-101 | Win rate by opponent strength — breakdown chart | Horizontal bar chart: <1400, 1400-1600, 1600-1800, 1800-2000, 2000+ |
| FR-102 | Rating gain per tournament — efficiency metric | Bar chart showing rating change per tournament, average line |
| FR-103 | Peer crossing prediction — "When will I overtake Player X?" | Two regression lines with intersection point highlighted |
| FR-104 | Performance expectation — given recent opponents, expected score | Uses Elo expectedScore() from lib/analytics |
| FR-105 | Player comparison cards — side-by-side 2-3 players | All metrics shown side-by-side in card layout |
| FR-106 | Head-to-head record — games between two selected players | W/D/L record, rating at time of each game, trend |

### Nice to Have (P2)

| ID | Requirement | Acceptance Criteria |
|----|------------|---------------------|
| FR-201 | Club vs Club comparison — aggregate metrics for two clubs | Average rating, improvement rate, age distribution |
| FR-202 | Historical comparison — "Compare me with players who were my rating 5 years ago" | Time-shifted overlay showing career trajectories |
| FR-203 | Export analytics — download as image or CSV | Chart screenshot or data export button |
| FR-204 | Shareable URL — link to a specific player's analytics | URL encodes player ID + active filters |

## Non-Functional Requirements

### Performance
- Dashboard load: < 2s from cache, < 5s cold
- Chart rendering: < 500ms for 20 players
- Scraping: background with progress indicator, not blocking UI

### Scalability
- Must handle any Israeli club (up to 250 members)
- Rating history: up to 200 data points per player

### Data Freshness
- Cache TTL: 24 hours for rating data
- On-demand refresh button with progress indicator
- Incremental scraping (only fetch what's new)

## Technical Constraints
- Use existing Chart.js + react-chartjs-2 stack
- Reuse lib/analytics/ functions where possible
- Data from chess.org.il scraper (rate-limited, ~2s between requests)
- File-based cache (.cache/ directory) for scraped data
- Next.js App Router, TypeScript, Tailwind CSS

## Dependencies

### Internal
- `lib/scrapers/chess-org-il.ts` — player data scraping
- `lib/analytics/` — Elo calculations, performance rating
- `lib/cache/club-cache.ts` — file-based caching
- `components/features/club-rating-chart.tsx` — existing chart component

### External
- chess.org.il — data source (rate-limited)
- chart.js, react-chartjs-2, chartjs-adapter-date-fns — charting
- date-fns — date manipulation

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| chess.org.il rate limiting blocks scraping | Medium | High | Aggressive caching, background scraping, 2s delays |
| chess.org.il HTML structure changes | Low | High | Scraper tests against saved fixtures, alert on parse failures |
| Too many data points slows chart | Medium | Medium | Limit visible players, use data decimation, lazy load |
| Linear regression inaccurate for volatile players | Medium | Low | Show confidence bands, flag high-volatility players |
| Player name matching across data sources fails | Medium | Medium | Match by Israeli ID (authoritative), fallback to fuzzy name match |
