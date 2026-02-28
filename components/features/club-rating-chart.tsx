"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";
import { Button } from "@/components/ui/button";

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const COLORS = [
  "#2563eb", // blue-600
  "#dc2626", // red-600
  "#16a34a", // green-600
  "#9333ea", // purple-600
  "#ea580c", // orange-600
  "#0891b2", // cyan-600
  "#db2777", // pink-600
  "#ca8a04", // yellow-600
  "#4f46e5", // indigo-600
  "#059669", // emerald-600
  "#7c3aed", // violet-600
  "#be123c", // rose-700
  "#0d9488", // teal-600
  "#c2410c", // orange-700
  "#1d4ed8", // blue-700
  "#15803d", // green-700
  "#7e22ce", // purple-700
  "#b91c1c", // red-700
  "#0e7490", // cyan-700
  "#a21caf", // fuchsia-700
  "#a16207", // yellow-700
];

interface RatingEntry {
  period: string;
  rating: number;
  recordedAt: string;
}

interface PlayerData {
  israeliId: number;
  name: string;
  rating: number;
  ratingHistory: RatingEntry[];
}

interface ClubRatingChartProps {
  players: PlayerData[];
}

export function ClubRatingChart({ players }: ClubRatingChartProps) {
  // Build a unified timeline of all unique dates across all players
  const { allDates, playerTimelines } = useMemo(() => {
    const dateSet = new Set<string>();
    for (const p of players) {
      for (const r of p.ratingHistory) {
        const d = new Date(r.recordedAt).toISOString().split("T")[0];
        dateSet.add(d);
      }
    }
    const sorted = Array.from(dateSet).sort();

    // For each player, build a map of date -> rating
    const timelines = players.map((p) => {
      const map = new Map<string, number>();
      for (const r of p.ratingHistory) {
        const d = new Date(r.recordedAt).toISOString().split("T")[0];
        map.set(d, r.rating);
      }
      return map;
    });

    return { allDates: sorted, playerTimelines: timelines };
  }, [players]);

  const totalPoints = allDates.length;

  const [currentIndex, setCurrentIndex] = useState(totalPoints);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [enabledPlayers, setEnabledPlayers] = useState<Set<number>>(
    () => new Set(players.map((_, i) => i))
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const play = useCallback(() => {
    if (currentIndex >= totalPoints) {
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  }, [currentIndex, totalPoints]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const ms = Math.max(30, 200 / speed);
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= totalPoints) {
          setIsPlaying(false);
          return totalPoints;
        }
        return prev + 1;
      });
    }, ms);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed, totalPoints]);

  const visibleDates = allDates.slice(0, currentIndex);

  const datasets = players
    .map((player, playerIdx) => {
      if (!enabledPlayers.has(playerIdx)) return null;

      // Build data points: for each visible date, use the latest known rating up to that date
      const data: { x: string; y: number }[] = [];
      let lastKnown: number | null = null;
      const timeline = playerTimelines[playerIdx];

      for (const date of visibleDates) {
        const val = timeline.get(date);
        if (val !== undefined) lastKnown = val;
        if (lastKnown !== null && timeline.has(date)) {
          data.push({ x: date, y: lastKnown });
        }
      }

      if (data.length === 0) return null;

      return {
        label: player.name,
        data,
        borderColor: COLORS[playerIdx % COLORS.length],
        backgroundColor: COLORS[playerIdx % COLORS.length],
        borderWidth: 2,
        tension: 0.3,
        pointRadius: data.length < 30 ? 3 : 1,
        pointHoverRadius: 5,
        fill: false,
      };
    })
    .filter(Boolean);

  const chartData = {
    datasets: datasets as NonNullable<(typeof datasets)[0]>[],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          title: (items: any[]) => {
            if (!items.length) return "";
            const d = new Date(items[0].parsed.x);
            return d.toLocaleDateString("he-IL");
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (item: any) =>
            `${item.dataset.label}: ${item.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        type: "time" as const,
        time: { unit: "month" as const, displayFormats: { month: "MMM yy" } },
        title: { display: true, text: "Date" },
      },
      y: {
        title: { display: true, text: "Israeli Rating" },
        beginAtZero: false,
      },
    },
    interaction: {
      mode: "nearest" as const,
      intersect: false,
    },
  };

  const togglePlayer = (idx: number) => {
    setEnabledPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const currentDateLabel =
    visibleDates.length > 0
      ? new Date(visibleDates[visibleDates.length - 1]).toLocaleDateString("he-IL", {
          month: "short",
          year: "numeric",
        })
      : "";

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={isPlaying ? pause : play}
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </Button>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Speed:</span>
          {[1, 2, 4, 8].map((s) => (
            <button
              key={s}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                speed === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>

        <span className="text-sm font-medium text-muted-foreground ml-auto">
          {currentDateLabel}
        </span>
      </div>

      {/* Timeline scrubber */}
      <input
        type="range"
        min={1}
        max={totalPoints}
        value={currentIndex}
        onChange={(e) => {
          setCurrentIndex(parseInt(e.target.value, 10));
          setIsPlaying(false);
        }}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />

      {/* Chart */}
      <div className="relative" style={{ height: "500px" }}>
        <Line data={chartData} options={options} />
      </div>

      {/* Player toggles */}
      <div className="flex flex-wrap gap-2">
        <button
          className="text-xs text-muted-foreground underline mr-2"
          onClick={() =>
            setEnabledPlayers(
              enabledPlayers.size === players.length
                ? new Set()
                : new Set(players.map((_, i) => i))
            )
          }
        >
          {enabledPlayers.size === players.length ? "Hide All" : "Show All"}
        </button>
        {players.map((player, idx) => (
          <button
            key={player.israeliId}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-opacity ${
              enabledPlayers.has(idx) ? "opacity-100" : "opacity-40"
            }`}
            style={{
              backgroundColor: `${COLORS[idx % COLORS.length]}20`,
              color: COLORS[idx % COLORS.length],
              borderLeft: `3px solid ${COLORS[idx % COLORS.length]}`,
            }}
            onClick={() => togglePlayer(idx)}
          >
            {player.name}
            <span className="text-[10px] opacity-70">{player.rating}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
