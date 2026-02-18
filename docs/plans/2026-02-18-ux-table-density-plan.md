# UX Table Density (Chess.com Style) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform all tables to Chess.com-style dense layout with colored title badges and table-based pairings.

**Architecture:** Pure frontend changes — modify the base Shadcn table component for global density, create a new TitleBadge component, update StandingsTable to merge title into player column, and rewrite PairingsView from cards to a table layout.

**Tech Stack:** React, Tailwind CSS v4, Shadcn/ui Table component, TypeScript.

---

### Task 1: Create TitleBadge Component

**Files:**
- Create: `components/ui/title-badge.tsx`
- Create: `tests/unit/title-badge.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/title-badge.test.ts`:

```typescript
import { getTitleStyle } from "@/components/ui/title-badge";

describe("getTitleStyle", () => {
  it("returns amber style for GM", () => {
    const style = getTitleStyle("GM");
    expect(style).toEqual({
      bg: "bg-amber-500/20",
      text: "text-amber-700 dark:text-amber-400",
    });
  });

  it("returns orange style for IM", () => {
    const style = getTitleStyle("IM");
    expect(style.bg).toBe("bg-orange-500/20");
  });

  it("returns teal style for FM", () => {
    const style = getTitleStyle("FM");
    expect(style.bg).toBe("bg-teal-500/20");
  });

  it("returns sky style for CM", () => {
    const style = getTitleStyle("CM");
    expect(style.bg).toBe("bg-sky-500/20");
  });

  it("returns slate style for NM", () => {
    const style = getTitleStyle("NM");
    expect(style.bg).toBe("bg-slate-500/20");
  });

  it("maps WGM to GM colors", () => {
    const style = getTitleStyle("WGM");
    expect(style.bg).toBe("bg-amber-500/20");
  });

  it("maps WIM to IM colors", () => {
    const style = getTitleStyle("WIM");
    expect(style.bg).toBe("bg-orange-500/20");
  });

  it("maps WFM to FM colors", () => {
    const style = getTitleStyle("WFM");
    expect(style.bg).toBe("bg-teal-500/20");
  });

  it("maps WCM to CM colors", () => {
    const style = getTitleStyle("WCM");
    expect(style.bg).toBe("bg-sky-500/20");
  });

  it("returns null for empty/null title", () => {
    expect(getTitleStyle(null)).toBeNull();
    expect(getTitleStyle("")).toBeNull();
  });

  it("returns slate style for unknown titles", () => {
    const style = getTitleStyle("AGM");
    expect(style!.bg).toBe("bg-slate-500/20");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest tests/unit/title-badge.test.ts --no-cache`
Expected: FAIL — `Cannot find module '@/components/ui/title-badge'`

**Step 3: Write the component**

Create `components/ui/title-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface TitleStyle {
  bg: string;
  text: string;
}

const TITLE_STYLES: Record<string, TitleStyle> = {
  GM:  { bg: "bg-amber-500/20",  text: "text-amber-700 dark:text-amber-400" },
  IM:  { bg: "bg-orange-500/20", text: "text-orange-700 dark:text-orange-400" },
  FM:  { bg: "bg-teal-500/20",   text: "text-teal-700 dark:text-teal-400" },
  CM:  { bg: "bg-sky-500/20",    text: "text-sky-700 dark:text-sky-400" },
  NM:  { bg: "bg-slate-500/20",  text: "text-slate-600 dark:text-slate-400" },
};

export function getTitleStyle(title: string | null | undefined): TitleStyle | null {
  if (!title) return null;
  const t = title.toUpperCase().trim();
  if (!t) return null;
  // WGM → GM, WIM → IM, etc.
  const base = t.startsWith("W") && t.length > 1 ? t.slice(1) : t;
  return TITLE_STYLES[base] ?? TITLE_STYLES["NM"];
}

export function TitleBadge({ title, className }: { title: string | null | undefined; className?: string }) {
  const style = getTitleStyle(title);
  if (!style) return null;
  return (
    <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[11px] font-bold leading-none", style.bg, style.text, className)}>
      {title}
    </span>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest tests/unit/title-badge.test.ts --no-cache`
Expected: All 11 tests PASS

**Step 5: Commit**

```bash
git add components/ui/title-badge.tsx tests/unit/title-badge.test.ts
git commit -m "feat(CHESS-2): add TitleBadge component with colored chess title pills"
```

---

### Task 2: Update Base Table Component

**Files:**
- Modify: `components/ui/table.tsx`

**Step 1: Update Table base element**

In `components/ui/table.tsx`, change the `<table>` className:
- From: `"w-full caption-bottom text-sm"`
- To: `"w-full caption-bottom text-[13px]"`

**Step 2: Update TableRow**

Remove hover effect, increase zebra contrast:
- From: `"border-b transition-colors hover:bg-muted/50 even:bg-muted/20 data-[state=selected]:bg-muted"`
- To: `"border-b transition-colors even:bg-muted/30 data-[state=selected]:bg-muted"`

**Step 3: Update TableHead**

Add sticky header background:
- From: `"h-9 px-2 py-1.5 text-left align-middle text-xs uppercase tracking-wider font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"`
- To: `"h-8 px-2 py-1 text-left align-middle text-xs uppercase tracking-wider font-medium text-muted-foreground bg-muted/60 [&:has([role=checkbox])]:pr-0"`

**Step 4: Update TableCell**

Reduce vertical padding:
- From: `"px-2 py-1.5 align-middle [&:has([role=checkbox])]:pr-0"`
- To: `"px-2 py-1 align-middle [&:has([role=checkbox])]:pr-0"`

**Step 5: Visual verification**

Run: `npm run dev`
Open: `http://localhost:3002/tournaments/<id>`
Verify: All tables show denser rows (~32px height), no hover highlight, stronger zebra striping, header has subtle background.

**Step 6: Run existing tests**

Run: `npm test`
Expected: All 171 tests still pass (table changes are CSS-only, no logic affected)

**Step 7: Commit**

```bash
git add components/ui/table.tsx
git commit -m "feat(CHESS-2): increase table density - 13px font, tighter padding, stronger zebra"
```

---

### Task 3: Update StandingsTable — Merge Title Column

**Files:**
- Modify: `components/features/standings-table.tsx`

**Step 1: Add TitleBadge import**

Add at top of file:
```typescript
import { TitleBadge } from "@/components/ui/title-badge";
```

**Step 2: Remove max-w-3xl**

Change the wrapper div:
- From: `<div className="rounded-md border overflow-x-auto max-w-3xl">`
- To: `<div className="rounded-md border overflow-x-auto">`

**Step 3: Remove the standalone Title column header**

Remove this line from the `<TableHeader>`:
```tsx
<TableHead>Title</TableHead>
```

**Step 4: Merge TitleBadge into Player cell**

Replace the Player `<TableCell>` (lines 140-151) with:
```tsx
<TableCell className="font-medium">
  <span className="inline-flex items-center gap-1.5">
    <TitleBadge title={entry.title} />
    {playerHref ? (
      <Link href={playerHref} className="text-primary hover:underline">
        {entry.name}
      </Link>
    ) : (
      entry.name
    )}
  </span>
</TableCell>
```

**Step 5: Remove the standalone Title cell**

Remove these lines from the row rendering:
```tsx
<TableCell className="text-muted-foreground">
  {entry.title || ""}
</TableCell>
```

**Step 6: Visual verification**

Run: `npm run dev`
Open: `http://localhost:3002/tournaments/<id>` → Standings tab
Verify:
- Title badge (colored pill) appears before player name in same cell
- No separate Title column
- Table is full-width (no max-width constraint)
- Sorting still works on all columns
- Followed player highlighting still works

**Step 7: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add components/features/standings-table.tsx
git commit -m "feat(CHESS-2): merge title badges into player column, remove max-width"
```

---

### Task 4: Rewrite PairingsView — Cards to Table

**Files:**
- Modify: `components/features/pairings-view.tsx`

This is the biggest change. The entire card layout gets replaced with a table.

**Step 1: Add new imports**

Replace the imports section with:
```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useFollowedPlayers } from "@/components/providers/followed-players-provider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TitleBadge } from "@/components/ui/title-badge";
```

**Step 2: Update the Pairing interface**

Add title fields to the Pairing interface:
```typescript
interface Pairing {
  board: number;
  whitePlayerId?: string | null;
  whiteName: string;
  whiteTitle?: string | null;
  blackPlayerId?: string | null;
  blackName: string;
  blackTitle?: string | null;
  whiteRating: number | null;
  blackRating: number | null;
  result: string | null;
}
```

**Step 3: Replace helper functions**

Remove `borderColor` function. Replace `resultColor` and `PlayerName` with:

```typescript
function resultBgColor(result: string | null): string {
  if (!result) return "";
  if (result === "1/2-1/2") return "bg-amber-500/15";
  return "bg-emerald-500/15";
}

function resultTextColor(result: string | null, side: "white" | "black"): string {
  if (!result) return "";
  if (result === "1/2-1/2") return "text-amber-600 dark:text-amber-400";
  if ((result === "1-0" && side === "white") || (result === "0-1" && side === "black")) {
    return "text-emerald-600 dark:text-emerald-400 font-bold";
  }
  return "text-red-600 dark:text-red-400";
}

function PlayerCell({
  playerId,
  name,
  title,
  side,
  result,
  tournamentId,
}: {
  playerId?: string | null;
  name: string;
  title?: string | null;
  side: "white" | "black";
  result: string | null;
  tournamentId?: string;
}) {
  const colorClass = resultTextColor(result, side);
  const href = playerId
    ? tournamentId
      ? `/tournaments/${tournamentId}/players/${playerId}`
      : `/players/${playerId}`
    : null;

  return (
    <span className={`inline-flex items-center gap-1.5 ${colorClass}`}>
      <TitleBadge title={title} />
      {href ? (
        <Link href={href} className="hover:underline truncate">
          {name}
        </Link>
      ) : (
        <span className="truncate">{name}</span>
      )}
    </span>
  );
}
```

**Step 4: Rewrite the render body**

Replace everything inside the return statement (after the round selector div) with:

```tsx
{/* Pairings table */}
{roundPairings.length === 0 ? (
  <p className="text-muted-foreground text-sm py-8 text-center">
    No pairings available for round {round}
  </p>
) : (
  <div className="rounded-md border overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>White</TableHead>
          <TableHead className="hidden sm:table-cell w-16 text-right">Rtg</TableHead>
          <TableHead className="w-20 text-center">Result</TableHead>
          <TableHead className="hidden sm:table-cell w-16 text-right">Rtg</TableHead>
          <TableHead>Black</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roundPairings.map((p) => {
          const hasFollowed =
            (p.whitePlayerId && followedPlayerIds.has(p.whitePlayerId)) ||
            (p.blackPlayerId && followedPlayerIds.has(p.blackPlayerId));
          return (
            <TableRow
              key={p.board}
              className={hasFollowed ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}
            >
              <TableCell className="text-muted-foreground tabular-nums">
                {p.board}
              </TableCell>
              <TableCell>
                <PlayerCell
                  playerId={p.whitePlayerId}
                  name={p.whiteName}
                  title={p.whiteTitle}
                  side="white"
                  result={p.result}
                  tournamentId={tournamentId}
                />
              </TableCell>
              <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                {p.whiteRating ?? "—"}
              </TableCell>
              <TableCell className={`text-center font-mono text-xs ${resultBgColor(p.result)} rounded`}>
                {p.result || "—"}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                {p.blackRating ?? "—"}
              </TableCell>
              <TableCell>
                <PlayerCell
                  playerId={p.blackPlayerId}
                  name={p.blackName}
                  title={p.blackTitle}
                  side="black"
                  result={p.result}
                  tournamentId={tournamentId}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>
)}
```

**Step 5: Check if API provides title data in pairings**

Read `app/api/tournaments/[id]/route.ts` to see if pairings include `whiteTitle`/`blackTitle`. If not, the `TitleBadge` will gracefully render nothing (returns null for null/undefined title). This can be enhanced later by adding title to the pairings query.

**Step 6: Visual verification**

Run: `npm run dev`
Open: `http://localhost:3002/tournaments/<id>` → Pairings tab
Verify:
- Pairings show as table rows, not cards
- Board number, White, Rating, Result, Rating, Black columns visible
- Result cell has colored background tint
- Rating columns hidden on mobile
- Round selector still works
- Followed player rows highlighted in amber

**Step 7: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add components/features/pairings-view.tsx
git commit -m "feat(CHESS-2): rewrite pairings from card layout to dense table"
```

---

### Task 5: Final Verification & Cleanup

**Files:**
- None created/modified (verification only)

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Visual verification checklist**

Run: `npm run dev` and check all pages:

- [ ] `/tournaments/<id>` → Standings tab: dense rows, title badges, full-width, sorting works
- [ ] `/tournaments/<id>` → Pairings tab: table layout, round selector, result colors
- [ ] `/tournaments/<id>` → Players tab: inherits base density
- [ ] `/players/<id>` → Tournaments tab table: inherits density
- [ ] `/players/<id>` → Rating History table: inherits density
- [ ] Dark mode: all tables look correct
- [ ] Mobile (< 640px): rating/fed columns hidden, tables still usable

**Step 4: Commit final state (if any tweaks were needed)**

```bash
git add -A
git commit -m "fix(CHESS-2): polish table density edge cases"
```

---

## Summary

| Task | Files | Type | Effort |
|------|-------|------|--------|
| 1. TitleBadge | `title-badge.tsx`, test | Create + TDD | ~5 min |
| 2. Base table density | `table.tsx` | Modify (4 lines) | ~3 min |
| 3. StandingsTable merge | `standings-table.tsx` | Modify | ~5 min |
| 4. PairingsView rewrite | `pairings-view.tsx` | Major rewrite | ~15 min |
| 5. Final verification | None | Verification | ~5 min |
