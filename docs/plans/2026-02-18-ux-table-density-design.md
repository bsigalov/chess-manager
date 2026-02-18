# UX Table Density Design — Chess.com Style

**Date**: 2026-02-18
**Jira**: CHESS-2 (under Epic CHESS-1)
**Branch**: `feature/CHESS-2-ux-table-density`

## Approach

Chess.com Faithful — full density overhaul with borderless rows (keeping subtle borders), colored title badges, table-based pairings, and 13px font.

## Changes by Component

### 1. Base Table (`components/ui/table.tsx`)

- Font size: `text-[13px]` on `<table>`
- Cell padding: `px-2 py-1` (from `py-1.5`)
- Zebra: `even:bg-muted/30` (from `/20`)
- Keep borders (`border-b` stays)
- Remove hover effect (`hover:bg-muted/50` removed from `TableRow`)
- Header: add `bg-muted/60 backdrop-blur-sm` for visual separation

### 2. Title Badge (new: `components/ui/title-badge.tsx`)

Colored pill badge for chess titles. Styling: `px-1.5 py-0.5 rounded text-[11px] font-bold`

| Title | Background | Text Color |
|-------|-----------|------------|
| GM | `bg-amber-500/20` | `text-amber-700 dark:text-amber-400` |
| IM | `bg-orange-500/20` | `text-orange-700 dark:text-orange-400` |
| FM | `bg-teal-500/20` | `text-teal-700 dark:text-teal-400` |
| CM | `bg-sky-500/20` | `text-sky-700 dark:text-sky-400` |
| WGM/WIM/WFM/WCM | Same as base title with W prefix |
| NM | `bg-slate-500/20` | `text-slate-600 dark:text-slate-400` |
| No title | Nothing rendered |

### 3. StandingsTable (`components/features/standings-table.tsx`)

- Remove `max-w-3xl` constraint — full width
- Merge Title column into Player column (badge before name)
- Points: `text-sm font-bold`
- Tiebreak columns: keep `hidden md:table-cell text-muted-foreground`

### 4. PairingsView (`components/features/pairings-view.tsx`)

Redesign from card layout to table:

```
#  | White           | Rtg  | Result | Rtg  | Black
1  | GM Carlsen      | 2830 | 1-0    | 2750 | IM Doe
```

- Uses Shadcn Table component (inherits base density)
- Result cell: centered, `font-mono`, colored background tint
  - Win: `bg-emerald-500/15`
  - Draw: `bg-amber-500/15`
  - Loss: `bg-red-500/15`
- Title badge inline with player name
- Followed-player rows: amber highlight (existing pattern)
- Mobile (`<sm`): hide rating columns
- Round selector: unchanged (button row)

### 5. PlayerProfile (`components/features/player-profile.tsx`)

No specific changes — inherits base table density automatically.

### 6. Tournament Detail Players Tab

No specific changes — inherits base table density automatically.

## Files

| File | Action |
|------|--------|
| `components/ui/table.tsx` | Modify |
| `components/ui/title-badge.tsx` | Create |
| `components/features/standings-table.tsx` | Modify |
| `components/features/pairings-view.tsx` | Modify (major) |
| `components/features/player-profile.tsx` | No changes |

## Verification

1. `npm run typecheck` — no errors
2. `npm run dev` — visual check on tournament detail page
3. Compare standings density visually (before/after)
4. Check pairings in both light and dark mode
5. Test mobile responsive behavior (rating columns hidden)
6. Verify followed-player highlights still work
7. Run existing tests: `npm test`
