# Rating History Game Drilldown - Implementation Plan

## Overview

Add accordion-style expandable rows to the Rating History table. Each rating period row expands to show all tournaments played in that period, with scores and results. Clicking a tournament navigates to the player's tournament journey page.

## Current State

- `RatingHistoryTab` in `components/features/player-profile.tsx:108-314`
- Table rows: Period | Rating | Change | Source (flat, no interactivity)
- Player page already fetches `tournaments[]` with `startDate`, `endDate`, `points`, `gamesPlayed`, etc.
- No new data fetching needed for tournament-level drill-down

## Design

### UX Behavior

1. Each table row gets a chevron icon (right side or left of Period)
2. Clicking a row toggles an accordion panel below it
3. The panel lists all tournaments whose `endDate` falls within the rating period
4. Each tournament row shows: name, dates, score (pts/games), rating change
5. Clicking a tournament navigates to `/tournaments/[id]/players/[startingRank]`
6. If no tournaments match a period, show "No tracked tournaments in this period"
7. Multiple rows can be open simultaneously

### Date-Range Matching Logic

For each rating record at index `i` (table is newest-first):
- `periodEnd` = this record's `recordedAt`
- `periodStart` = previous (older) record's `recordedAt` (or epoch if last record)
- Match tournaments where: `periodStart < tournament.endDate <= periodEnd`

### Visual Design

```
┌──────────┬────────┬────────┬─────────────┐
│ Period   │ Rating │ Change │ Source    ▾  │
├──────────┼────────┼────────┼─────────────┤
│ ▼ Jan 26 │ 1779  │  +53   │ chess-org-il │
├──────────┴────────┴────────┴─────────────┤
│  📋 Rishon Summer Blitz  5.5/9   +28    │ ← clickable
│  📋 Herzliya Open        4.0/7   +25    │ ← clickable
├──────────┬────────┬────────┬─────────────┤
│ ▶ Dec 25 │ 1726  │  +12   │ chess-org-il │
├──────────┼────────┼────────┼─────────────┤
│ ▶ Nov 25 │ 1714  │  +14   │ chess-org-il │
└──────────┴────────┴────────┴─────────────┘
```

## Tasks

### Task 1: Compute period-to-tournament mapping (pure function)

**File**: `components/features/player-profile.tsx`

Create a function that takes the sorted rating entries and tournaments array, and returns a `Map<ratingEntryId, Tournament[]>`.

```typescript
function matchTournamentsToPeriods(
  ratingEntries: TableEntry[],  // newest-first
  tournaments: TournamentInfo[]
): Map<string, TournamentInfo[]>
```

- For each entry `i`, compute date range `(prevRecordedAt, recordedAt]`
- Filter tournaments whose `endDate` falls within range
- Sort matched tournaments by `endDate` desc within each period

### Task 2: Add accordion state and expand/collapse UI

**File**: `components/features/player-profile.tsx`

- Add `expandedPeriods` state: `Set<string>` of rating entry IDs
- Make each `<TableRow>` clickable with `cursor-pointer`
- Add chevron icon (ChevronRight/ChevronDown from lucide-react) in the Period cell
- Toggle the entry ID in the set on click
- Animate chevron rotation with CSS transition

### Task 3: Render expanded tournament list

**File**: `components/features/player-profile.tsx`

When a period is expanded, render a `<TableRow>` below it spanning all columns with:
- Tournament name (linked to `/tournaments/[tid]/players/[startingRank]`)
- Date range (formatted compact: "Jan 15-17")
- Score: `points/gamesPlayed`
- Rating delta: `currentRating - startingRating` (if available)
- Hover highlight on each tournament row
- "No tracked tournaments in this period" fallback

### Task 4: Pass tournaments data to RatingHistoryTab

**File**: `components/features/player-profile.tsx`

The `RatingHistoryTab` currently receives only `ratingHistory`. Add `tournaments` prop from the player data already available in `PlayerProfile`.

```typescript
function RatingHistoryTab({
  ratingHistory,
  tournaments  // ← add this
}: {
  ratingHistory: RatingEntry[];
  tournaments: TournamentInfo[]
})
```

No new API calls or DB queries needed — data is already fetched.

## File Changes Summary

| File | Change |
|------|--------|
| `components/features/player-profile.tsx` | Add accordion to RatingHistoryTab, pass tournaments prop |

**Single file change. No migrations. No new APIs. No new dependencies.**

## Testing

- E2E: Add test in `tests/e2e/players.spec.ts` — expand a period, verify tournament appears, click through
- Manual: Verify with a player who has both rating history and tournament data
