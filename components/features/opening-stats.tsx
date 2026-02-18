"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface OpeningEntry {
  ecoCode: string;
  openingName: string | null;
  wins: number;
  draws: number;
  losses: number;
  total: number;
}

interface OpeningStatsProps {
  playerId: string;
}

export function OpeningStats({ playerId }: OpeningStatsProps) {
  const [openings, setOpenings] = useState<OpeningEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/players/${playerId}/openings`)
      .then((r) => r.json())
      .then((data) => setOpenings(data.openings ?? []))
      .catch(() => setOpenings([]))
      .finally(() => setLoading(false));
  }, [playerId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (openings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No opening data available.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ECO</TableHead>
            <TableHead>Opening</TableHead>
            <TableHead className="text-right">Games</TableHead>
            <TableHead className="text-right">W/D/L</TableHead>
            <TableHead className="w-[120px]">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {openings.map((o) => {
            const scorePercent =
              o.total > 0
                ? Math.round(((o.wins + o.draws * 0.5) / o.total) * 100)
                : 0;
            const wPct = o.total > 0 ? (o.wins / o.total) * 100 : 0;
            const dPct = o.total > 0 ? (o.draws / o.total) * 100 : 0;
            const lPct = o.total > 0 ? (o.losses / o.total) * 100 : 0;

            return (
              <TableRow key={o.ecoCode}>
                <TableCell>
                  <Badge variant="outline">{o.ecoCode}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {o.openingName ?? "Unknown"}
                </TableCell>
                <TableCell className="text-right">{o.total}</TableCell>
                <TableCell className="text-right text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {o.wins}
                  </span>
                  /
                  <span className="text-amber-600 dark:text-amber-400">
                    {o.draws}
                  </span>
                  /
                  <span className="text-red-600 dark:text-red-400">
                    {o.losses}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-muted">
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${wPct}%` }}
                      />
                      <div
                        className="bg-amber-400 h-full"
                        style={{ width: `${dPct}%` }}
                      />
                      <div
                        className="bg-red-500 h-full"
                        style={{ width: `${lPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {scorePercent}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
