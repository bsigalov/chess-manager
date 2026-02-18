"use client";

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

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface TournamentEntry {
  tournamentName: string;
  startingRating: number | null;
  performance: number | null;
  points: number;
}

interface TournamentComparisonChartProps {
  tournaments: TournamentEntry[];
}

export function TournamentComparisonChart({
  tournaments,
}: TournamentComparisonChartProps) {
  if (tournaments.length === 0) return null;

  const labels = tournaments.map((t) =>
    t.tournamentName.length > 25
      ? t.tournamentName.slice(0, 22) + "..."
      : t.tournamentName
  );

  const data = {
    labels,
    datasets: [
      {
        label: "Performance",
        data: tournaments.map((t) => t.performance),
        backgroundColor: "rgba(37, 99, 235, 0.6)",
        borderColor: "rgb(37, 99, 235)",
        borderWidth: 1,
      },
      {
        label: "Rating",
        data: tournaments.map((t) => t.startingRating),
        backgroundColor: "rgba(220, 38, 38, 0.6)",
        borderColor: "rgb(220, 38, 38)",
        borderWidth: 1,
      },
    ],
  };

  const minRating = Math.min(
    ...tournaments
      .flatMap((t) => [t.performance, t.startingRating])
      .filter((v): v is number => v != null)
  );

  const options = {
    responsive: true,
    aspectRatio: 2.5,
    plugins: {
      legend: { position: "top" as const },
    },
    scales: {
      y: {
        min: Math.max(0, minRating - 100),
        title: { display: true, text: "Rating / Performance" },
      },
    },
  };

  return (
    <div className="w-full">
      <Bar data={data} options={options} />
    </div>
  );
}
