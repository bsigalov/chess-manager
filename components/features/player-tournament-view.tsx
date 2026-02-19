"use client";

import { useState } from "react";
import Link from "next/link";
import type { CrosstableEntry } from "@/lib/types/tournament";
import type { ChartOptions, TooltipItem } from "chart.js";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ─── Types ──────────────────────────────────────────────

interface PlayerTournamentViewProps {
  tournamentId: string;
  tournamentName: string;
  playerName: string;
  playerTitle: string | null;
  playerRating: number | null;
  playerDbId: string | null;
  stats: {
    wins: number;
    draws: number;
    losses: number;
    whiteGames: number;
    blackGames: number;
    whiteScore: number;
    blackScore: number;
    averageOpponentRating: number | null;
    performanceRating: number | null;
    scoreProgression: number[];
  };
  games: {
    round: number;
    color: "w" | "b" | null;
    opponentName: string;
    opponentRating: number | null;
    result: number;
    cumulativeScore: number;
    isBye: boolean;
    isForfeit: boolean;
  }[];
  ratingProgression: {
    round: number;
    ratingAfter: number;
    ratingChange: number;
    expectedScore: number;
    opponentRating: number | null;
    actualResult: number;
  }[];
  rankProgression: {
    round: number;
    rank: number;
    points: number;
  }[];
  crosstable: CrosstableEntry[];
  totalRounds: number;
}

type TabId = "games" | "rating" | "position";

// ─── Helpers ────────────────────────────────────────────

function formatResult(result: number): string {
  if (result === 1) return "1";
  if (result === 0.5) return "\u00BD";
  return "0";
}

function resultColor(result: number): string {
  if (result === 1) return "text-green-600 dark:text-green-400";
  if (result === 0.5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "0";
  return Math.round((numerator / denominator) * 100).toString();
}

// ─── Component ──────────────────────────────────────────

export function PlayerTournamentView({
  tournamentId,
  tournamentName,
  playerName,
  playerTitle,
  playerRating,
  playerDbId,
  stats,
  games,
  ratingProgression,
  rankProgression,
  crosstable: _crosstable,
  totalRounds: _totalRounds,
}: PlayerTournamentViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("games");

  const totalGames = stats.wins + stats.draws + stats.losses;
  const displayName = playerTitle
    ? `${playerTitle} ${playerName}`
    : playerName;

  const tabs: { id: TabId; label: string }[] = [
    { id: "games", label: "Games" },
    { id: "rating", label: "Rating" },
    { id: "position", label: "Position" },
  ];

  return (
    <div className="container px-4 py-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
        <Link
          href={`/tournaments/${tournamentId}`}
          className="hover:text-foreground transition-colors"
        >
          {tournamentName}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{playerName}</span>
      </nav>

      {/* Summary section */}
      <div className="rounded-lg border bg-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            {playerRating !== null && (
              <p className="text-muted-foreground">Rating: {playerRating}</p>
            )}
          </div>
          {playerDbId && (
            <Link
              href={`/players/${playerDbId}`}
              className="text-sm text-primary hover:underline font-medium"
            >
              View Player Profile &rarr;
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {/* W/D/L */}
          <div>
            <p className="text-muted-foreground mb-1">Result</p>
            <p className="font-medium">
              <span className="text-green-600 dark:text-green-400">
                +{stats.wins}
              </span>
              {" "}
              <span className="text-amber-600 dark:text-amber-400">
                ={stats.draws}
              </span>
              {" "}
              <span className="text-red-600 dark:text-red-400">
                -{stats.losses}
              </span>
              <span className="text-muted-foreground ml-1.5">
                ({stats.scoreProgression[stats.scoreProgression.length - 1] ?? 0}/{totalGames})
              </span>
            </p>
          </div>

          {/* Color balance */}
          <div>
            <p className="text-muted-foreground mb-1">Color Balance</p>
            <p className="font-medium">
              White: {stats.whiteScore}/{stats.whiteGames} ({pct(stats.whiteScore, stats.whiteGames)}%)
            </p>
            <p className="font-medium">
              Black: {stats.blackScore}/{stats.blackGames} ({pct(stats.blackScore, stats.blackGames)}%)
            </p>
          </div>

          {/* Avg opponent rating */}
          <div>
            <p className="text-muted-foreground mb-1">Avg Opp. Rating</p>
            <p className="font-medium">
              {stats.averageOpponentRating ?? "N/A"}
            </p>
          </div>

          {/* Performance rating */}
          <div>
            <p className="text-muted-foreground mb-1">Performance</p>
            <p className="font-medium">
              {stats.performanceRating ?? "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "games" && <GamesTab games={games} />}
      {activeTab === "rating" && (
        <RatingTab
          ratingProgression={ratingProgression}
          startingRating={playerRating}
        />
      )}
      {activeTab === "position" && (
        <PositionTab rankProgression={rankProgression} />
      )}
    </div>
  );
}

// ─── Games Tab ──────────────────────────────────────────

function GamesTab({
  games,
}: {
  games: PlayerTournamentViewProps["games"];
}) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2.5 text-left font-medium w-14">Rd</th>
            <th className="px-3 py-2.5 text-center font-medium w-12">Color</th>
            <th className="px-3 py-2.5 text-left font-medium">Opponent</th>
            <th className="px-3 py-2.5 text-right font-medium w-16">Rating</th>
            <th className="px-3 py-2.5 text-center font-medium w-16">Result</th>
            <th className="px-3 py-2.5 text-right font-medium w-14">Cum.</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr
              key={game.round}
              className={`border-b hover:bg-muted/30 ${
                game.isBye ? "italic text-muted-foreground" : ""
              }`}
            >
              <td className="px-3 py-2">{game.round}</td>
              <td className="px-3 py-2 text-center">
                {game.color === "w" ? (
                  <span title="White" className="text-base">{"\u26AA"}</span>
                ) : game.color === "b" ? (
                  <span title="Black" className="text-base">{"\u26AB"}</span>
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </td>
              <td className="px-3 py-2">
                {game.isBye ? (
                  <span>BYE</span>
                ) : (
                  <span>{game.opponentName}</span>
                )}
                {game.isForfeit && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    (forfeit)
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {game.opponentRating ?? "--"}
              </td>
              <td
                className={`px-3 py-2 text-center font-semibold tabular-nums ${resultColor(game.result)}`}
              >
                {formatResult(game.result)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {game.cumulativeScore % 1 === 0
                  ? game.cumulativeScore
                  : game.cumulativeScore.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Rating Tab ─────────────────────────────────────────

function RatingTab({
  ratingProgression,
  startingRating,
}: {
  ratingProgression: PlayerTournamentViewProps["ratingProgression"];
  startingRating: number | null;
}) {
  if (ratingProgression.length === 0 || startingRating === null) {
    return (
      <p className="text-muted-foreground py-4">
        Rating progression is not available (player has no rating).
      </p>
    );
  }

  const labels = ["Start", ...ratingProgression.map((s) => `R${s.round}`)];
  const dataPoints = [
    startingRating,
    ...ratingProgression.map((s) => s.ratingAfter),
  ];

  const minRating = Math.min(...dataPoints);
  const maxRating = Math.max(...dataPoints);
  const padding = Math.max(10, Math.round((maxRating - minRating) * 0.2));

  const chartData = {
    labels,
    datasets: [
      {
        label: "Rating",
        data: dataPoints,
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: minRating - padding,
        max: maxRating + padding,
        ticks: {
          stepSize: Math.max(
            1,
            Math.round((maxRating - minRating + 2 * padding) / 6)
          ),
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<"line">) =>
            `Rating: ${Math.round(ctx.parsed.y ?? 0)}`,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="rounded-lg border bg-card p-4" style={{ height: 300 }}>
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2.5 text-left font-medium w-14">Rd</th>
              <th className="px-3 py-2.5 text-right font-medium">
                Opp. Rating
              </th>
              <th className="px-3 py-2.5 text-right font-medium">Expected</th>
              <th className="px-3 py-2.5 text-right font-medium">Actual</th>
              <th className="px-3 py-2.5 text-right font-medium">Change</th>
              <th className="px-3 py-2.5 text-right font-medium">Rating</th>
            </tr>
          </thead>
          <tbody>
            {ratingProgression.map((step) => {
              const isByeOrUnrated = step.opponentRating === null;
              const changeSign =
                step.ratingChange > 0
                  ? "+"
                  : step.ratingChange < 0
                    ? "\u2212"
                    : "\u00B1";

              return (
                <tr key={step.round} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2">{step.round}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {isByeOrUnrated ? "--" : step.opponentRating}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {isByeOrUnrated ? "--" : step.expectedScore.toFixed(2)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      isByeOrUnrated ? "" : resultColor(step.actualResult)
                    }`}
                  >
                    {isByeOrUnrated ? "--" : formatResult(step.actualResult)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums font-medium ${
                      step.ratingChange > 0
                        ? "text-green-600 dark:text-green-400"
                        : step.ratingChange < 0
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    }`}
                  >
                    {isByeOrUnrated
                      ? "--"
                      : `${changeSign}${Math.abs(step.ratingChange).toFixed(1)}`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {step.ratingAfter}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Position Tab ───────────────────────────────────────

function PositionTab({
  rankProgression,
}: {
  rankProgression: PlayerTournamentViewProps["rankProgression"];
}) {
  if (rankProgression.length === 0) {
    return (
      <p className="text-muted-foreground py-4">
        Position data is not available.
      </p>
    );
  }

  const labels = rankProgression.map((r) => `R${r.round}`);
  const ranks = rankProgression.map((r) => r.rank);
  const maxRank = Math.max(...ranks);

  const chartData = {
    labels,
    datasets: [
      {
        label: "Rank",
        data: ranks,
        borderColor: "rgb(168, 85, 247)",
        backgroundColor: "rgba(168, 85, 247, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        reverse: true,
        min: 1,
        max: maxRank + 1,
        ticks: {
          stepSize: Math.max(1, Math.round(maxRank / 8)),
          callback: (value: number | string) => `#${value}`,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<"line">) =>
            `Rank: #${ctx.parsed.y ?? 0}`,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="rounded-lg border bg-card p-4" style={{ height: 300 }}>
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2.5 text-left font-medium w-14">Rd</th>
              <th className="px-3 py-2.5 text-right font-medium">Rank</th>
              <th className="px-3 py-2.5 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {rankProgression.map((r) => (
              <tr key={r.round} className="border-b hover:bg-muted/30">
                <td className="px-3 py-2">{r.round}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  #{r.rank}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.points % 1 === 0 ? r.points : r.points.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
