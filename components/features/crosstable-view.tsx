"use client";

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

interface RoundResult {
  round: number;
  opponentRank: number | null;
  color: "w" | "b" | null;
  score: number;
  isBye: boolean;
  isForfeit: boolean;
}

interface CrosstableEntry {
  startingRank: number;
  name: string;
  title: string | null;
  rating: number | null;
  points: number;
  roundResults: RoundResult[];
}

interface CrosstableViewProps {
  crosstable: CrosstableEntry[];
  tournamentId?: string;
}

function scoreText(score: number): string {
  if (score === 1) return "1";
  if (score === 0.5) return "\u00BD";
  return "0";
}

function scoreColorClass(score: number): string {
  if (score === 1) return "text-emerald-600 dark:text-emerald-400";
  if (score === 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function ResultCell({ result }: { result: RoundResult }) {
  if (result.isBye) {
    return (
      <span className="text-xs text-muted-foreground">BYE</span>
    );
  }

  const oppRank = result.opponentRank ?? "?";
  const colorChar = result.color ?? "";
  const scoreChar = scoreText(result.score);

  return (
    <span className={`text-xs font-mono whitespace-nowrap ${scoreColorClass(result.score)}`}>
      {oppRank}
      {colorChar && (
        <span
          className="inline-flex items-center justify-center ml-0.5"
          title={result.color === "w" ? "White" : "Black"}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full border border-current ${
              result.color === "w"
                ? "bg-white dark:bg-gray-200"
                : "bg-gray-800 dark:bg-gray-600"
            }`}
          />
        </span>
      )}
      {scoreChar}
      {result.isForfeit && (
        <span className="text-muted-foreground ml-0.5" title="Forfeit">F</span>
      )}
    </span>
  );
}

export function CrosstableView({ crosstable, tournamentId }: CrosstableViewProps) {
  const { followedPlayers } = useFollowedPlayers();
  const followedNames = new Set(followedPlayers.map((p) => p.name));

  if (crosstable.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        No crosstable data available
      </p>
    );
  }

  const totalRounds = Math.max(
    ...crosstable.map((p) => p.roundResults.length)
  );

  const roundNumbers = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 sticky left-0 bg-background z-10">#</TableHead>
            <TableHead className="min-w-[140px] sticky left-12 bg-background z-10">
              Player
            </TableHead>
            <TableHead className="w-16">Rtg</TableHead>
            {roundNumbers.map((r) => (
              <TableHead key={r} className="w-16 text-center">
                {r}.Rd
              </TableHead>
            ))}
            <TableHead className="w-14 text-center font-bold">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {crosstable.map((player) => {
            const resultsByRound = new Map(
              player.roundResults.map((r) => [r.round, r])
            );

            const nameContent = (
              <span className="flex items-center gap-1">
                {player.title && (
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {player.title}
                  </span>
                )}
                <span className="truncate">{player.name}</span>
              </span>
            );

            const isFollowed = followedNames.has(player.name);

            return (
              <TableRow key={player.startingRank} className={isFollowed ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                <TableCell className={`font-medium text-muted-foreground sticky left-0 z-10 ${isFollowed ? "bg-amber-50/50 dark:bg-amber-950/20" : "bg-background"}`}>
                  {player.startingRank}
                </TableCell>
                <TableCell className={`font-medium sticky left-12 z-10 ${isFollowed ? "bg-amber-50/50 dark:bg-amber-950/20" : "bg-background"}`}>
                  {tournamentId ? (
                    <Link
                      href={`/tournaments/${tournamentId}/players/${player.startingRank}`}
                      className="text-primary hover:underline"
                    >
                      {nameContent}
                    </Link>
                  ) : (
                    nameContent
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {player.rating ?? "\u2014"}
                </TableCell>
                {roundNumbers.map((r) => {
                  const result = resultsByRound.get(r);
                  return (
                    <TableCell key={r} className="text-center px-2">
                      {result ? <ResultCell result={result} /> : (
                        <span className="text-muted-foreground text-xs">\u2014</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-bold">
                  {player.points}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
