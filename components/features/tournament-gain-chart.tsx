"use client";

import { useMemo } from "react";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";
import type { TournamentGain } from "@/lib/analytics/player-analytics";

Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, annotationPlugin);

interface TournamentGainChartProps {
  tournamentGains: TournamentGain[];
  avgGain?: number | null;
  height?: number;
}

export function TournamentGainChart({
  tournamentGains,
  avgGain,
  height = 200,
}: TournamentGainChartProps) {
  const { labels, data, colors, avgValue } = useMemo(() => {
    // Sort by date (chronological)
    const sorted = [...tournamentGains].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const labels = sorted.map((t) => {
      // Truncate long names
      const name = t.name.length > 15 ? t.name.substring(0, 15) + "..." : t.name;
      return name;
    });

    const data = sorted.map((t) => t.gain);

    // Color bars: green for positive, red for negative
    const colors = sorted.map((t) =>
      t.gain >= 0 ? "rgba(22, 163, 74, 0.8)" : "rgba(220, 38, 38, 0.8)"
    );

    // Calculate average
    const avg =
      avgGain ??
      (sorted.length > 0
        ? sorted.reduce((sum, t) => sum + t.gain, 0) / sorted.length
        : 0);

    return { labels, data, colors, avgValue: avg };
  }, [tournamentGains, avgGain]);

  if (tournamentGains.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg"
        style={{ height }}
      >
        No tournament data available
      </div>
    );
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: "Rating Change",
        data,
        backgroundColor: colors,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          title: (items: any[]) => {
            if (!items.length) return "";
            const idx = items[0].dataIndex;
            const sorted = [...tournamentGains].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            const t = sorted[idx];
            return t.name;
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (item: any) => {
            const idx = item.dataIndex;
            const sorted = [...tournamentGains].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            const t = sorted[idx];
            const dateStr = new Date(t.date).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            });
            const sign = t.gain >= 0 ? "+" : "";
            return [`Date: ${dateStr}`, `Rating change: ${sign}${t.gain}`];
          },
        },
      },
      annotation: {
        annotations: {
          averageLine: {
            type: "line" as const,
            yMin: avgValue,
            yMax: avgValue,
            borderColor: "rgba(107, 114, 128, 0.6)",
            borderWidth: 2,
            borderDash: [6, 4],
            label: {
              display: true,
              content: `Avg: ${avgValue >= 0 ? "+" : ""}${avgValue.toFixed(1)}`,
              position: "end" as const,
              backgroundColor: "rgba(107, 114, 128, 0.8)",
              font: { size: 11 },
              padding: 4,
            },
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          font: { size: 10 },
        },
      },
      y: {
        title: { display: true, text: "Rating Change", font: { size: 11 } },
        grid: { color: "rgba(0,0,0,0.05)" },
        ticks: {
          callback: (value: number | string) => {
            const num = typeof value === "number" ? value : parseFloat(value);
            return num >= 0 ? `+${num}` : num;
          },
        },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
