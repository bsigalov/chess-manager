# Player Tournament Page Enrichment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrich `/tournaments/{id}/players/{playerId}` with all available data and features: Follow button, streak/best-win stats, Head-to-Head tab, What-If tab, Openings tab; plus fix clickable player names throughout the app.

**Architecture:** All new data is derived from the `crosstable[]` already computed server-side in the page — no new APIs needed. Pass `crosstable` and `totalRounds` as additional props to `PlayerTournamentView`. Bug fix adds `tournamentId` prop to `PredictionsPanel` and `MagicNumbers` so they can build tournament-scoped player links.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, existing analytics libs (`what-if.ts`, `standings.ts`), existing components (`FollowButton`, `WhatIfPanel`, `OpeningStats`).

---

### Task 1: Pass `crosstable` and `totalRounds` into `PlayerTournamentView`

**Files:**
- Modify: `app/tournaments/[id]/players/[playerId]/page.tsx`
- Modify: `components/features/player-tournament-view.tsx`

**Step 1: Add props to the interface in `player-tournament-view.tsx`**

In the `PlayerTournamentViewProps` interface (around line 32), add:

```ts
crosstable: {
  startingRank: number;
  name: string;
  rating: number | null;
  points: number;
  roundResults: {
    round: number;
    opponentRank: number | null;
    color: "w" | "b" | null;
    score: number;
    isBye: boolean;
    isForfeit: boolean;
  }[];
}[];
totalRounds: number;
```

**Step 2: Destructure new props in the component function signature**

```ts
export function PlayerTournamentView({
  ...existing props...,
  crosstable,
  totalRounds,
}: PlayerTournamentViewProps) {
```

**Step 3: Pass the new props from the page**

In `app/tournaments/[id]/players/[playerId]/page.tsx`, the `crosstable` variable is already in scope (line ~100). `totalRounds` is already computed (line ~160). Add them to the `<PlayerTournamentView>` JSX:

```tsx
<PlayerTournamentView
  ...existing props...
  crosstable={crosstable}
  totalRounds={totalRounds}
/>
```

**Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "player-tournament"
```
Expected: no errors.

**Step 5: Commit**

```bash
git add components/features/player-tournament-view.tsx app/tournaments/\[id\]/players/\[playerId\]/page.tsx
git commit -m "feat: pass crosstable and totalRounds to PlayerTournamentView"
```

---

### Task 2: Add Follow button and streak + best-win to the summary header

**Files:**
- Modify: `components/features/player-tournament-view.tsx`

**Step 1: Import FollowButton**

```ts
import { FollowButton } from "@/components/features/follow-button";
```

**Step 2: Add streak and best-win helper functions** (add above the component)

```ts
function computeStreak(games: PlayerTournamentViewProps["games"]): { type: "W" | "D" | "L"; count: number } | null {
  if (games.length === 0) return null;
  const sorted = [...games].filter((g) => !g.isBye).sort((a, b) => a.round - b.round);
  if (sorted.length === 0) return null;
  const last = sorted[sorted.length - 1];
  const t = last.result === 1 ? "W" : last.result === 0.5 ? "D" : "L";
  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const r = sorted[i].result === 1 ? "W" : sorted[i].result === 0.5 ? "D" : "L";
    if (r === t) count++;
    else break;
  }
  return { type: t, count };
}

function bestWin(games: PlayerTournamentViewProps["games"]): { opponentName: string; opponentRating: number } | null {
  return games
    .filter((g) => g.result === 1 && g.opponentRating !== null)
    .reduce<{ opponentName: string; opponentRating: number } | null>((best, g) => {
      if (!best || g.opponentRating! > best.opponentRating) {
        return { opponentName: g.opponentName, opponentRating: g.opponentRating! };
      }
      return best;
    }, null);
}
```

**Step 3: Use in the component** — inside `PlayerTournamentView`, compute:

```ts
const streak = computeStreak(games);
const topWin = bestWin(games);
```

**Step 4: Add Follow button** — in the header `div` next to "View Player Profile" link:

```tsx
{playerDbId && (
  <FollowButton playerId={playerDbId} />
)}
```

**Step 5: Add streak and best-win to the stats grid** — add two new `<div>` cells in the existing 4-column stats grid:

```tsx
{/* Streak */}
{streak && (
  <div>
    <p className="text-muted-foreground mb-1">Streak</p>
    <p className={`font-medium text-lg ${
      streak.type === "W" ? "text-green-600 dark:text-green-400" :
      streak.type === "D" ? "text-amber-600 dark:text-amber-400" :
      "text-red-600 dark:text-red-400"
    }`}>
      {streak.type}{streak.count}
    </p>
  </div>
)}
{/* Best win */}
{topWin && (
  <div>
    <p className="text-muted-foreground mb-1">Best Win</p>
    <p className="font-medium truncate" title={topWin.opponentName}>
      {topWin.opponentName}
    </p>
    <p className="text-xs text-muted-foreground">{topWin.opponentRating}</p>
  </div>
)}
```

Change the stats grid from `grid-cols-2 sm:grid-cols-4` to `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` to fit 6 cells.

**Step 6: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "player-tournament"
```

**Step 7: Commit**

```bash
git add components/features/player-tournament-view.tsx
git commit -m "feat: add follow button, streak and best-win to player tournament summary"
```

---

### Task 3: Add Head-to-Head tab

**Files:**
- Modify: `components/features/player-tournament-view.tsx`

**Step 1: Add `"h2h"` to the `TabId` type**

```ts
type TabId = "games" | "rating" | "position" | "h2h" | "whatif" | "openings";
```

**Step 2: Add tab entry to the `tabs` array**

```ts
{ id: "h2h", label: "Head-to-Head" },
```

**Step 3: Add `<HeadToHeadTab>` render in the tab content section**

```tsx
{activeTab === "h2h" && <HeadToHeadTab games={games} />}
```

**Step 4: Add `HeadToHeadTab` component** (at the bottom of the file, same pattern as `GamesTab`):

```tsx
function HeadToHeadTab({ games }: { games: PlayerTournamentViewProps["games"] }) {
  const realGames = games.filter((g) => !g.isBye && !g.isForfeit);

  // Group by opponent name
  const opponentMap = new Map<string, {
    name: string;
    rating: number | null;
    wins: number;
    draws: number;
    losses: number;
    score: number;
    games: number;
  }>();

  for (const g of realGames) {
    const key = g.opponentName;
    const existing = opponentMap.get(key) ?? {
      name: g.opponentName,
      rating: g.opponentRating,
      wins: 0, draws: 0, losses: 0, score: 0, games: 0,
    };
    existing.games++;
    existing.score += g.result;
    if (g.result === 1) existing.wins++;
    else if (g.result === 0.5) existing.draws++;
    else existing.losses++;
    opponentMap.set(key, existing);
  }

  const rows = [...opponentMap.values()].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  if (rows.length === 0) {
    return <p className="text-muted-foreground py-4">No games played.</p>;
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2.5 text-left font-medium">Opponent</th>
            <th className="px-3 py-2.5 text-right font-medium w-16">Rating</th>
            <th className="px-3 py-2.5 text-center font-medium w-24">W / D / L</th>
            <th className="px-3 py-2.5 text-right font-medium w-16">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b hover:bg-muted/30">
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {row.rating ?? "—"}
              </td>
              <td className="px-3 py-2 text-center tabular-nums">
                <span className="text-green-600 dark:text-green-400">{row.wins}</span>
                {" / "}
                <span className="text-amber-600 dark:text-amber-400">{row.draws}</span>
                {" / "}
                <span className="text-red-600 dark:text-red-400">{row.losses}</span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                {row.score % 1 === 0 ? row.score : row.score.toFixed(1)}/{row.games}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 5: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "player-tournament"
```

**Step 6: Commit**

```bash
git add components/features/player-tournament-view.tsx
git commit -m "feat: add head-to-head tab to player tournament page"
```

---

### Task 4: Add What-If tab

**Files:**
- Modify: `components/features/player-tournament-view.tsx`

**Step 1: Import WhatIfPanel**

```ts
import { WhatIfPanel } from "@/components/features/what-if-panel";
```

**Step 2: Add tab entry**

```ts
{ id: "whatif", label: "What-If" },
```

**Step 3: Add tab content render**

```tsx
{activeTab === "whatif" && (
  <WhatIfPanel
    tournamentId={tournamentId}
    crosstable={crosstable}
    totalRounds={totalRounds}
  />
)}
```

Note: `WhatIfPanel` expects `crosstable` as `CrosstableEntry[]`. The type in `player-tournament-view.tsx` is an inline type — make sure it's compatible. If TypeScript complains, import `CrosstableEntry` from `@/lib/types/tournament` and use it in the props interface.

**Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "player-tournament\|what-if"
```

**Step 5: Commit**

```bash
git add components/features/player-tournament-view.tsx
git commit -m "feat: add what-if tab to player tournament page"
```

---

### Task 5: Add Openings tab (conditional on playerDbId)

**Files:**
- Modify: `components/features/player-tournament-view.tsx`

**Step 1: Import OpeningStats**

```ts
import { OpeningStats } from "@/components/features/opening-stats";
```

**Step 2: Add tab entry conditionally**

Instead of a static `tabs` array, make it dynamic:

```ts
const tabs: { id: TabId; label: string }[] = [
  { id: "games", label: "Games" },
  { id: "rating", label: "Rating" },
  { id: "position", label: "Position" },
  { id: "h2h", label: "Head-to-Head" },
  { id: "whatif", label: "What-If" },
  ...(playerDbId ? [{ id: "openings" as TabId, label: "Openings" }] : []),
];
```

**Step 3: Add tab content render**

```tsx
{activeTab === "openings" && playerDbId && (
  <OpeningStats playerId={playerDbId} />
)}
```

**Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "player-tournament\|opening"
```

**Step 5: Commit**

```bash
git add components/features/player-tournament-view.tsx
git commit -m "feat: add openings tab to player tournament page"
```

---

### Task 6 (Bug Fix): Clickable player names in PredictionsPanel and MagicNumbers

**Files:**
- Modify: `components/features/predictions-panel.tsx`
- Modify: `components/features/magic-numbers.tsx`
- Modify: `app/tournaments/[id]/tournament-detail.tsx` (where these are rendered)

**Step 1: Add `tournamentId?: string` prop to `PredictionsPanelProps`**

In `predictions-panel.tsx`, add to the interface:
```ts
interface PredictionsPanelProps {
  simulation: SimulationResult | null;
  loading?: boolean;
  tournamentId?: string;   // <-- add
}
```

Destructure in the function signature.

**Step 2: Wrap player names in PredictionsPanel with links**

Replace the plain `{player.name}` cell (~line 82):

```tsx
<TableCell>
  {tournamentId ? (
    <Link href={`/tournaments/${tournamentId}/players/${player.startingRank}`} className="text-primary hover:underline">
      {player.name}
    </Link>
  ) : (
    player.name
  )}
</TableCell>
```

Add `import Link from "next/link";` at the top.

**Step 3: Add `tournamentId?: string` prop to `MagicNumbersProps`**

In `magic-numbers.tsx`, add to the interface:
```ts
interface MagicNumbersProps {
  crosstable: CrosstableEntry[];
  totalRounds: number;
  tournamentId?: string;   // <-- add
}
```

**Step 4: Wrap scenario names in MagicNumbers with links**

Scenarios have `name` and derive from players that have `startingRank`. The scenario object needs `startingRank` too. Update the scenario builder (in the `computeScenarios` function or equivalent) to include `startingRank`, then wrap:

```tsx
{tournamentId ? (
  <Link href={`/tournaments/${tournamentId}/players/${scenario.startingRank}`} className="hover:underline">
    {scenario.name}
  </Link>
) : scenario.name}
```

**Step 5: Pass `tournamentId` from `tournament-detail.tsx`**

Find the `<PredictionsPanel>` and `<MagicNumbers>` usages and add `tournamentId={tournament.id}`.

**Step 6: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "predictions\|magic"
```

**Step 7: Commit**

```bash
git add components/features/predictions-panel.tsx components/features/magic-numbers.tsx app/tournaments/\[id\]/tournament-detail.tsx
git commit -m "fix: make player names clickable in PredictionsPanel and MagicNumbers"
```

---

### Task 7 (Bug Fix): Clickable player names in Pairings tab

**Files:**
- Modify: `components/features/pairings-view.tsx`
- Verify: `app/tournaments/[id]/tournament-detail.tsx` passes `tournamentId`

**Step 1: Check current state**

```bash
grep -n "tournamentId\|Link\|href" components/features/pairings-view.tsx | head -20
```

**Step 2: If player names are plain text**, wrap them exactly as in Task 6 — link to `/tournaments/${tournamentId}/players/${startingRank}`.

Note: pairings use `whitePlayerId`/`blackPlayerId` which are DB UUIDs. Check if the page already has `startingRank` in the pairing data. If not, pairings may need `whiteStartingRank`/`blackStartingRank` added to the API response.

Check `app/api/tournaments/[id]/route.ts` to see what pairing fields are returned. If startingRank is missing from pairings, add it to the API query (join via `TournamentPlayer` table).

**Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add components/features/pairings-view.tsx
git commit -m "fix: make player names clickable in pairings view"
```

---

## Verification

After all tasks:

```bash
npm test
npx tsc --noEmit
```

Visit `http://localhost:3002/tournaments/cd8522ad-f6cd-4ab7-b302-a824b4b3b34a` and verify:
1. Standings player names → link to player tournament page ✓
2. Player tournament page has Follow button in header ✓
3. Stats bar shows streak (e.g. W3) and best win ✓
4. Tabs: Games, Rating, Position, Head-to-Head, What-If, Openings ✓
5. Analytics tab — player names in predictions table are links ✓
6. Magic Numbers cards — player names are links ✓
