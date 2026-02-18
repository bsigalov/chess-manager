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

interface PairingsViewProps {
  pairings: Record<number, Pairing[]>;
  totalRounds: number;
  currentRound: number;
  loading?: boolean;
  tournamentId?: string;
  showOnlyFollowed?: boolean;
}

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

export function PairingsView({
  pairings,
  totalRounds,
  currentRound,
  loading,
  tournamentId,
  showOnlyFollowed,
}: PairingsViewProps) {
  const [round, setRound] = useState(currentRound || 1);
  const { followedPlayerIds } = useFollowedPlayers();

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  const allRoundPairings = pairings[round] || [];
  const roundPairings = showOnlyFollowed
    ? allRoundPairings.filter(
        (p) =>
          (p.whitePlayerId && followedPlayerIds.has(p.whitePlayerId)) ||
          (p.blackPlayerId && followedPlayerIds.has(p.blackPlayerId))
      )
    : allRoundPairings;

  return (
    <div className="space-y-4">
      {/* Round selector */}
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
          <Button
            key={r}
            variant={r === round ? "default" : "outline"}
            size="sm"
            onClick={() => setRound(r)}
            disabled={!pairings[r]}
          >
            {r}
          </Button>
        ))}
      </div>

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
                    <TableCell className={`text-center font-mono text-xs rounded ${resultBgColor(p.result)}`}>
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
    </div>
  );
}
