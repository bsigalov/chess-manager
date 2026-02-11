"use client";

import { useState } from "react";
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

interface StandingsEntry {
  rank: number;
  name: string;
  title: string | null;
  rating: number | null;
  federation: string | null;
  points: number;
  performance: number | null;
}

interface StandingsTableProps {
  standings: StandingsEntry[];
  loading?: boolean;
}

type SortKey = "rank" | "name" | "rating" | "points" | "performance";

export function StandingsTable({ standings, loading }: StandingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortAsc, setSortAsc] = useState(false);

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

  const sorted = [...standings].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === "string" && typeof bv === "string") {
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const SortHeader = ({
    label,
    field,
  }: {
    label: string;
    field: SortKey;
  }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </TableHead>
  );

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader label="#" field="rank" />
            <SortHeader label="Player" field="name" />
            <TableHead>Title</TableHead>
            <SortHeader label="Rating" field="rating" />
            <TableHead>Fed</TableHead>
            <SortHeader label="Points" field="points" />
            <SortHeader label="Perf" field="performance" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((entry, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{entry.rank}</TableCell>
              <TableCell className="font-medium">{entry.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {entry.title || ""}
              </TableCell>
              <TableCell>{entry.rating ?? "—"}</TableCell>
              <TableCell>{entry.federation ?? ""}</TableCell>
              <TableCell className="font-bold">{entry.points}</TableCell>
              <TableCell className="text-muted-foreground">
                {entry.performance ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
