"use client";

import Link from "next/link";

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

interface MagicNumbersProps {
  crosstable: CrosstableEntry[];
  totalRounds: number;
  tournamentId?: string;
}

type Scenario =
  | { type: "clinched"; name: string; points: number }
  | { type: "eliminated"; name: string; points: number; maxPossible: number; leaderPoints: number }
  | { type: "alive"; name: string; points: number; needed: number; remaining: number };

function computeScenarios(crosstable: CrosstableEntry[], totalRounds: number): Scenario[] {
  const sorted = [...crosstable].sort((a, b) => b.points - a.points);
  const top10 = sorted.slice(0, 10);

  if (top10.length === 0) return [];

  const leaderPoints = sorted[0].points;

  // For clinch calculation, find max possible for second place
  const secondPlaceMaxPossible = sorted.length > 1
    ? sorted[1].points + (totalRounds - sorted[1].roundResults.length)
    : 0;

  return top10.map((player) => {
    const remaining = totalRounds - player.roundResults.length;
    const maxPossible = player.points + remaining;

    if (maxPossible < leaderPoints && player.startingRank !== sorted[0].startingRank) {
      return {
        type: "eliminated" as const,
        name: player.name,
        points: player.points,
        maxPossible,
        leaderPoints,
      };
    }

    if (
      player.startingRank === sorted[0].startingRank &&
      player.points > secondPlaceMaxPossible
    ) {
      return {
        type: "clinched" as const,
        name: player.name,
        points: player.points,
      };
    }

    const needed = Math.max(0, leaderPoints - player.points);
    return {
      type: "alive" as const,
      name: player.name,
      points: player.points,
      needed,
      remaining,
    };
  });
}

function ScenarioCard({
  scenario,
  tournamentId,
  rankByName,
}: {
  scenario: Scenario;
  tournamentId?: string;
  rankByName?: Map<string, number>;
}) {
  const rank = rankByName?.get(scenario.name);
  const nameEl =
    tournamentId && rank ? (
      <Link
        href={`/tournaments/${tournamentId}/players/${rank}`}
        className="hover:underline font-semibold"
      >
        {scenario.name}
      </Link>
    ) : (
      <span className="font-semibold">{scenario.name}</span>
    );

  switch (scenario.type) {
    case "clinched":
      return (
        <div className="rounded-lg border p-4 bg-green-100 dark:bg-green-950 border-green-300 dark:border-green-800">
          <p className="text-green-800 dark:text-green-200 text-sm">
            {nameEl}
          </p>
          <p className="text-green-700 dark:text-green-300 text-xs mt-1">
            Has clinched 1st place with {scenario.points} pts
          </p>
        </div>
      );

    case "eliminated":
      return (
        <div className="rounded-lg border p-4 bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-800">
          <p className="text-red-800 dark:text-red-200 text-sm">
            {nameEl}
          </p>
          <p className="text-red-700 dark:text-red-300 text-xs mt-1">
            Eliminated &mdash; max {scenario.maxPossible} pts vs leader&apos;s {scenario.leaderPoints}
          </p>
        </div>
      );

    case "alive":
      return (
        <div className="rounded-lg border p-4 bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700">
          <p className="text-slate-800 dark:text-slate-200 text-sm">
            {nameEl}
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
            {scenario.remaining > 0 ? (
              <>
                Needs {scenario.needed} more pts from {scenario.remaining} remaining
              </>
            ) : (
              <>Finished with {scenario.points} pts</>
            )}
          </p>
        </div>
      );
  }
}

export function MagicNumbers({ crosstable, totalRounds, tournamentId }: MagicNumbersProps) {
  const scenarios = computeScenarios(crosstable, totalRounds);
  const rankByName = new Map(crosstable.map((e) => [e.name, e.startingRank]));

  if (scenarios.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        No data available for magic numbers
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {scenarios.map((scenario) => (
        <ScenarioCard key={scenario.name} scenario={scenario} tournamentId={tournamentId} rankByName={rankByName} />
      ))}
    </div>
  );
}
