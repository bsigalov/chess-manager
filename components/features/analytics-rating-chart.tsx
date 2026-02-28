"use client";

import { useMemo } from "react";
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
import type { RatingEntry } from "@/lib/scrapers/chess-org-il";
import type { Prediction } from "@/lib/analytics/player-analytics";

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

const PRIMARY_COLOR = "#2563eb"; // blue-600
const PREDICTION_COLOR = "#9333ea"; // purple-600
const MILESTONE_COLOR = "#6b7280"; // gray-500

// Standard milestones
const MILESTONES = [1400, 1600, 1800, 2000, 2200, 2400];

interface ComparisonPlayer {
  name: string;
  israeliId: number;
  ratingHistory: RatingEntry[];
  color?: string;
}

interface AnalyticsRatingChartProps {
  ratingHistory: RatingEntry[];
  playerName: string;
  prediction3mo?: Prediction | null;
  prediction6mo?: Prediction | null;
  prediction12mo?: Prediction | null;
  comparisonPlayers?: ComparisonPlayer[];
  showMilestones?: boolean;
  height?: number;
}

export function AnalyticsRatingChart({
  ratingHistory,
  playerName,
  prediction3mo,
  prediction6mo,
  prediction12mo,
  comparisonPlayers = [],
  showMilestones = true,
  height = 300,
}: AnalyticsRatingChartProps) {
  const { datasets, milestoneAnnotations, yAxisRange } = useMemo(() => {
    // Sort history by date (oldest first)
    const sortedHistory = [...ratingHistory].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    // Main player data
    const mainData = sortedHistory.map((entry) => ({
      x: new Date(entry.recordedAt).toISOString().split("T")[0],
      y: entry.rating,
    }));

    const allDatasets: ReturnType<typeof buildDataset>[] = [];

    // Main player line
    allDatasets.push({
      label: playerName,
      data: mainData,
      borderColor: PRIMARY_COLOR,
      backgroundColor: PRIMARY_COLOR,
      borderWidth: 2.5,
      tension: 0.3,
      pointRadius: mainData.length < 30 ? 4 : 2,
      pointHoverRadius: 6,
      fill: false,
      order: 1, // Draw on top
    });

    // Calculate y-axis range
    const allRatings = mainData.map((d) => d.y);
    let minRating = Math.min(...allRatings);
    let maxRating = Math.max(...allRatings);

    // Add prediction data if available
    if (sortedHistory.length > 0 && (prediction3mo || prediction6mo || prediction12mo)) {
      const lastDate = new Date(sortedHistory[sortedHistory.length - 1].recordedAt);
      const lastRating = sortedHistory[sortedHistory.length - 1].rating;

      // Build prediction points
      const predictionData: { x: string; y: number }[] = [
        { x: lastDate.toISOString().split("T")[0], y: lastRating },
      ];
      const predictionBandUpper: { x: string; y: number }[] = [
        { x: lastDate.toISOString().split("T")[0], y: lastRating },
      ];
      const predictionBandLower: { x: string; y: number }[] = [
        { x: lastDate.toISOString().split("T")[0], y: lastRating },
      ];

      if (prediction3mo) {
        const date3mo = new Date(lastDate);
        date3mo.setMonth(date3mo.getMonth() + 3);
        const dateStr = date3mo.toISOString().split("T")[0];
        predictionData.push({ x: dateStr, y: prediction3mo.rating });
        predictionBandUpper.push({ x: dateStr, y: prediction3mo.high });
        predictionBandLower.push({ x: dateStr, y: prediction3mo.low });
        maxRating = Math.max(maxRating, prediction3mo.high);
        minRating = Math.min(minRating, prediction3mo.low);
      }

      if (prediction6mo) {
        const date6mo = new Date(lastDate);
        date6mo.setMonth(date6mo.getMonth() + 6);
        const dateStr = date6mo.toISOString().split("T")[0];
        predictionData.push({ x: dateStr, y: prediction6mo.rating });
        predictionBandUpper.push({ x: dateStr, y: prediction6mo.high });
        predictionBandLower.push({ x: dateStr, y: prediction6mo.low });
        maxRating = Math.max(maxRating, prediction6mo.high);
        minRating = Math.min(minRating, prediction6mo.low);
      }

      if (prediction12mo) {
        const date12mo = new Date(lastDate);
        date12mo.setMonth(date12mo.getMonth() + 12);
        const dateStr = date12mo.toISOString().split("T")[0];
        predictionData.push({ x: dateStr, y: prediction12mo.rating });
        predictionBandUpper.push({ x: dateStr, y: prediction12mo.high });
        predictionBandLower.push({ x: dateStr, y: prediction12mo.low });
        maxRating = Math.max(maxRating, prediction12mo.high);
        minRating = Math.min(minRating, prediction12mo.low);
      }

      // Prediction regression line (dashed)
      if (predictionData.length > 1) {
        allDatasets.push({
          label: "Prediction",
          data: predictionData,
          borderColor: PREDICTION_COLOR,
          backgroundColor: PREDICTION_COLOR,
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0,
          pointRadius: 4,
          pointStyle: "circle",
          fill: false,
          order: 2,
        });
      }

      // Confidence band (filled area)
      if (predictionBandUpper.length > 1) {
        // Upper bound line (invisible, just for fill target)
        allDatasets.push({
          label: "Upper Bound",
          data: predictionBandUpper,
          borderColor: "transparent",
          backgroundColor: `${PREDICTION_COLOR}20`,
          borderWidth: 0,
          tension: 0,
          pointRadius: 0,
          fill: "+1", // Fill to next dataset
          order: 3,
        });

        // Lower bound line
        allDatasets.push({
          label: "Lower Bound",
          data: predictionBandLower,
          borderColor: "transparent",
          backgroundColor: "transparent",
          borderWidth: 0,
          tension: 0,
          pointRadius: 0,
          fill: false,
          order: 4,
        });
      }
    }

    // Comparison players
    const COMPARISON_COLORS = [
      "#dc2626", // red-600
      "#16a34a", // green-600
      "#ea580c", // orange-600
      "#0891b2", // cyan-600
      "#db2777", // pink-600
    ];

    comparisonPlayers.forEach((player, idx) => {
      const sortedComp = [...player.ratingHistory].sort(
        (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
      );
      const compData = sortedComp.map((entry) => ({
        x: new Date(entry.recordedAt).toISOString().split("T")[0],
        y: entry.rating,
      }));

      if (compData.length > 0) {
        const color = player.color || COMPARISON_COLORS[idx % COMPARISON_COLORS.length];
        allDatasets.push({
          label: player.name,
          data: compData,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 1.5,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          order: 10 + idx,
        });

        compData.forEach((d) => {
          minRating = Math.min(minRating, d.y);
          maxRating = Math.max(maxRating, d.y);
        });
      }
    });

    // Milestone annotations (horizontal lines at standard ratings)
    const visibleMilestones = MILESTONES.filter(
      (m) => m >= minRating - 50 && m <= maxRating + 50
    );

    const milestoneAnnotations = showMilestones
      ? visibleMilestones.map((rating) => ({
          rating,
          color: MILESTONE_COLOR,
        }))
      : [];

    // Add padding to y-axis
    const padding = Math.max(50, (maxRating - minRating) * 0.1);

    return {
      datasets: allDatasets,
      milestoneAnnotations,
      yAxisRange: {
        min: Math.floor((minRating - padding) / 50) * 50,
        max: Math.ceil((maxRating + padding) / 50) * 50,
      },
    };
  }, [
    ratingHistory,
    playerName,
    prediction3mo,
    prediction6mo,
    prediction12mo,
    comparisonPlayers,
    showMilestones,
  ]);

  const chartData = {
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: {
        display: comparisonPlayers.length > 0,
        position: "bottom" as const,
        labels: {
          filter: (item: { text: string }) =>
            !["Upper Bound", "Lower Bound"].includes(item.text),
        },
      },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          title: (items: any[]) => {
            if (!items.length) return "";
            const d = new Date(items[0].parsed.x);
            return d.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            });
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (item: any): string | void => {
            if (["Upper Bound", "Lower Bound"].includes(item.dataset.label)) {
              return;
            }
            return `${item.dataset.label}: ${item.parsed.y.toFixed(0)}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "time" as const,
        time: { unit: "month" as const, displayFormats: { month: "MMM yy" } },
        title: { display: false },
        grid: { color: "rgba(0,0,0,0.05)" },
      },
      y: {
        title: { display: true, text: "Israeli Rating" },
        min: yAxisRange.min,
        max: yAxisRange.max,
        grid: {
          color: (context: { tick: { value: number } }) => {
            // Highlight milestone lines
            const value = context.tick.value;
            if (MILESTONES.includes(value)) {
              return "rgba(107, 114, 128, 0.4)"; // gray-500 with opacity
            }
            return "rgba(0,0,0,0.05)";
          },
        },
        ticks: {
          callback: (value: number | string) => {
            const num = typeof value === "number" ? value : parseFloat(value);
            // Bold milestone values
            return MILESTONES.includes(num) ? `▸ ${num}` : num;
          },
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      intersect: false,
    },
  };

  if (ratingHistory.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg"
        style={{ height }}
      >
        No rating history available
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
}

// Helper to build consistent dataset objects
function buildDataset(opts: {
  label: string;
  data: { x: string; y: number }[];
  borderColor: string;
  backgroundColor: string;
  borderWidth: number;
  tension: number;
  pointRadius: number;
  pointHoverRadius?: number;
  pointStyle?: string;
  fill: boolean | string;
  order: number;
  borderDash?: number[];
}) {
  return opts;
}
