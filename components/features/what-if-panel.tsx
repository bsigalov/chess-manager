"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

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
  rating: number | null;
  points: number;
  roundResults: RoundResult[];
}

interface WhatIfPanelProps {
  tournamentId: string;
  crosstable: CrosstableEntry[];
  totalRounds: number;
}

interface HypotheticalResult {
  id: string;
  round: number;
  playerA: CrosstableEntry;
  playerB: CrosstableEntry;
  outcome: "a" | "draw" | "b";
}

interface SimulationResult {
  startingRank: number;
  name: string;
  points: number;
  projectedRank: number;
}

export function WhatIfPanel({ tournamentId, crosstable, totalRounds }: WhatIfPanelProps) {
  const [hypotheticals, setHypotheticals] = useState<HypotheticalResult[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>("");
  const [playerAId, setPlayerAId] = useState<string>("");
  const [playerBId, setPlayerBId] = useState<string>("");
  const [outcome, setOutcome] = useState<"a" | "draw" | "b">("draw");
  const [simulating, setSimulating] = useState(false);
  const [results, setResults] = useState<SimulationResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Find which rounds have not been fully played
  const playedRounds = Math.max(
    ...crosstable.map((p) => p.roundResults.length),
    0
  );
  const remainingRounds = Array.from(
    { length: totalRounds - playedRounds },
    (_, i) => playedRounds + i + 1
  );

  const playerMap = new Map(
    crosstable.map((p) => [String(p.startingRank), p])
  );

  function handleAdd() {
    const a = playerMap.get(playerAId);
    const b = playerMap.get(playerBId);
    const round = Number(selectedRound);

    if (!a || !b || !round || a.startingRank === b.startingRank) return;

    const id = `${round}-${a.startingRank}-${b.startingRank}`;

    // Prevent duplicate pairings
    if (hypotheticals.some((h) => h.id === id)) return;

    setHypotheticals((prev) => [
      ...prev,
      { id, round, playerA: a, playerB: b, outcome },
    ]);

    // Reset selections
    setPlayerAId("");
    setPlayerBId("");
    setOutcome("draw");
  }

  function handleRemove(id: string) {
    setHypotheticals((prev) => prev.filter((h) => h.id !== id));
    setResults(null);
  }

  async function handleSimulate() {
    if (hypotheticals.length === 0) return;

    setSimulating(true);
    setError(null);
    setResults(null);

    const payload = {
      hypotheticals: hypotheticals.map((h) => ({
        round: h.round,
        playerARank: h.playerA.startingRank,
        playerBRank: h.playerB.startingRank,
        outcome: h.outcome,
      })),
    };

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Simulation failed (${res.status})`);
      }

      const data = await res.json();
      setResults(data.standings ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  function outcomeLabel(h: HypotheticalResult): string {
    if (h.outcome === "a") return `${h.playerA.name} wins`;
    if (h.outcome === "b") return `${h.playerB.name} wins`;
    return "Draw";
  }

  const canAdd =
    playerAId && playerBId && selectedRound && playerAId !== playerBId;

  return (
    <div className="space-y-6">
      {/* Add hypothetical pairing */}
      {remainingRounds.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Add Hypothetical Result</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Round selector */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Round</label>
              <Select value={selectedRound} onValueChange={setSelectedRound}>
                <SelectTrigger>
                  <SelectValue placeholder="Round" />
                </SelectTrigger>
                <SelectContent>
                  {remainingRounds.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      Round {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Player A */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Player A</label>
              <Select value={playerAId} onValueChange={setPlayerAId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {crosstable.map((p) => (
                    <SelectItem
                      key={p.startingRank}
                      value={String(p.startingRank)}
                      disabled={String(p.startingRank) === playerBId}
                    >
                      {p.name} ({p.rating ?? "?"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Player B */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Player B</label>
              <Select value={playerBId} onValueChange={setPlayerBId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {crosstable.map((p) => (
                    <SelectItem
                      key={p.startingRank}
                      value={String(p.startingRank)}
                      disabled={String(p.startingRank) === playerAId}
                    >
                      {p.name} ({p.rating ?? "?"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Outcome */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Result</label>
              <Select
                value={outcome}
                onValueChange={(v) => setOutcome(v as "a" | "draw" | "b")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">A wins (1-0)</SelectItem>
                  <SelectItem value="draw">Draw (½-½)</SelectItem>
                  <SelectItem value="b">B wins (0-1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button size="sm" onClick={handleAdd} disabled={!canAdd}>
            Add Pairing
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          All rounds have been played. No remaining rounds to simulate.
        </p>
      )}

      {/* Hypothetical results list */}
      {hypotheticals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">
            Hypothetical Results ({hypotheticals.length})
          </h3>
          <div className="space-y-2">
            {hypotheticals.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div className="text-sm">
                  <span className="text-muted-foreground mr-2">Rd {h.round}</span>
                  <span className="font-medium">{h.playerA.name}</span>
                  <span className="text-muted-foreground mx-2">vs</span>
                  <span className="font-medium">{h.playerB.name}</span>
                  <span className="text-muted-foreground mx-2">&mdash;</span>
                  <span
                    className={
                      h.outcome === "draw"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {outcomeLabel(h)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(h.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <Button onClick={handleSimulate} disabled={simulating}>
            {simulating ? "Simulating..." : "Simulate"}
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {simulating && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {/* Simulation results */}
      {results && !simulating && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Projected Standings</h3>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="w-20 text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow key={r.startingRank}>
                    <TableCell className="font-medium text-muted-foreground">
                      {r.projectedRank ?? i + 1}
                    </TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right font-bold">
                      {r.points}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
