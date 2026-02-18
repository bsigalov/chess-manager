"use client";

import { useState } from "react";
import Link from "next/link";
import { useFollowedPlayers } from "@/components/providers/followed-players-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown } from "lucide-react";
import { TitleBadge } from "@/components/ui/title-badge";

interface StandingsEntry {
  playerId?: string;
  rank: number;
  name: string;
  title: string | null;
  rating: number | null;
  federation: string | null;
  points: number;
  performance: number | null;
  buchholz?: number | null;
  sonnebornBerger?: number | null;
}

interface StandingsTableProps {
  standings: StandingsEntry[];
  loading?: boolean;
  tournamentId?: string;
  showOnlyFollowed?: boolean;
}

type SortKey = "rank" | "name" | "rating" | "points" | "performance" | "buchholz" | "sonnebornBerger";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400/20 text-yellow-600 dark:text-yellow-400 font-bold text-xs">{rank}</span>;
  if (rank === 2) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-300/30 text-gray-600 dark:text-gray-300 font-bold text-xs">{rank}</span>;
  if (rank === 3) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-400/20 text-orange-600 dark:text-orange-400 font-bold text-xs">{rank}</span>;
  return <span className="tabular-nums">{rank}</span>;
}

function perfColor(perf: number | null, rating: number | null): string {
  if (perf == null || rating == null) return "text-muted-foreground";
  if (perf > rating) return "text-emerald-600 dark:text-emerald-400";
  if (perf < rating) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

export function StandingsTable({ standings, loading, tournamentId, showOnlyFollowed }: StandingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortAsc, setSortAsc] = useState(false);
  const { followedPlayerIds } = useFollowedPlayers();

  const hasTiebreaks = standings.some((e) => e.buchholz != null);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  }

  const filtered = showOnlyFollowed
    ? standings.filter((e) => e.playerId && followedPlayerIds.has(e.playerId))
    : standings;

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === "string" && typeof bv === "string") {
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  function sortHeader(label: string, field: SortKey, className?: string) {
    return (
      <TableHead
        className={`cursor-pointer select-none hover:text-foreground ${className ?? ""}`}
        onClick={() => handleSort(field)}
      >
        <span className="flex items-center gap-1">
          {label}
          <ArrowUpDown className="h-3 w-3" />
        </span>
      </TableHead>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {sortHeader("#", "rank")}
            {sortHeader("Player", "name")}
            {sortHeader("Rating", "rating")}
            <TableHead className="hidden md:table-cell">Fed</TableHead>
            {sortHeader("Pts", "points")}
            {hasTiebreaks && (
              <>
                {sortHeader("Buc", "buchholz", "hidden md:table-cell")}
                {sortHeader("SB", "sonnebornBerger", "hidden md:table-cell")}
              </>
            )}
            {sortHeader("Perf", "performance", "hidden sm:table-cell")}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((entry, i) => {
            const playerHref = tournamentId && entry.playerId
              ? `/tournaments/${tournamentId}/players/${entry.playerId}`
              : entry.playerId
                ? `/players/${entry.playerId}`
                : null;
            const isFollowed = entry.playerId && followedPlayerIds.has(entry.playerId);

            return (
              <TableRow key={entry.playerId ?? i} className={isFollowed ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                <TableCell className="font-medium">
                  <RankBadge rank={entry.rank} />
                </TableCell>
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
                <TableCell className="tabular-nums">{entry.rating ?? "\u2014"}</TableCell>
                <TableCell className="hidden md:table-cell">{entry.federation ?? ""}</TableCell>
                <TableCell className="font-bold tabular-nums">{entry.points}</TableCell>
                {hasTiebreaks && (
                  <>
                    <TableCell className="hidden md:table-cell tabular-nums text-muted-foreground">
                      {entry.buchholz != null ? entry.buchholz.toFixed(1) : "\u2014"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell tabular-nums text-muted-foreground">
                      {entry.sonnebornBerger != null ? entry.sonnebornBerger.toFixed(1) : "\u2014"}
                    </TableCell>
                  </>
                )}
                <TableCell className={`hidden sm:table-cell tabular-nums ${perfColor(entry.performance, entry.rating)}`}>
                  {entry.performance ?? "\u2014"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
