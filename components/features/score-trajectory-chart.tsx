"use client";

import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ScoreTrajectoryChartProps {
  players: {
    name: string;
    scoreProgression: number[];
  }[];
  totalRounds: number;
}

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
];

export function ScoreTrajectoryChart({
  players,
  totalRounds,
}: ScoreTrajectoryChartProps) {
  const top10 = players.slice(0, 10);
  const labels = Array.from({ length: totalRounds }, (_, i) => `Round ${i + 1}`);

  const data = {
    labels,
    datasets: top10.map((player, i) => ({
      label: player.name,
      data: player.scoreProgression,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length],
      tension: 0.2,
      pointRadius: 3,
      pointHoverRadius: 5,
    })),
  };

  const options = {
    responsive: true,
    aspectRatio: 2,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Score",
        },
      },
    },
  };

  return (
    <div className="w-full">
      <Line data={data} options={options} />
    </div>
  );
}
