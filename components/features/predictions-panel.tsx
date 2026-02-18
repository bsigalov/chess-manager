"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface PlayerPrediction {
  startingRank: number;
  name: string;
  probFirst: number;
  probTop3: number;
  expectedPoints: number;
  pointsStdDev: number;
  positionDistribution: number[];
}

interface Simulation {
  iterations: number;
  players: PlayerPrediction[];
}

interface PredictionsPanelProps {
  simulation: Simulation | null;
  loading?: boolean;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function PredictionsPanel({ simulation, loading }: PredictionsPanelProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!simulation) {
    return (
      <div className="rounded-md border p-6 text-center">
        <p className="text-muted-foreground text-sm">
          Simulation not available (tournament completed)
        </p>
      </div>
    );
  }

  const sorted = [...simulation.players]
    .sort((a, b) => b.probFirst - a.probFirst)
    .slice(0, 15);

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">Player</TableHead>
              <TableHead className="w-20 text-right">P(1st)</TableHead>
              <TableHead className="w-20 text-right">P(Top 3)</TableHead>
              <TableHead className="w-24 text-right">Exp. Pts</TableHead>
              <TableHead className="w-20 text-right">Std Dev</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((player) => {
              const isHighProb = player.probFirst > 0.2;

              return (
                <TableRow key={player.startingRank}>
                  <TableCell className="font-medium truncate">
                    {player.name}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono text-sm ${
                      isHighProb
                        ? "font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : ""
                    }`}
                  >
                    {formatPct(player.probFirst)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatPct(player.probTop3)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {player.expectedPoints.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {player.pointsStdDev.toFixed(2)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground text-right">
        Based on {simulation.iterations.toLocaleString()} Monte Carlo iterations
      </p>
    </div>
  );
}
