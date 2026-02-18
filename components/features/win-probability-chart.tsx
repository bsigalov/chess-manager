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

Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface WinProbabilityChartProps {
  players: {
    name: string;
    probFirst: number;
    probTop3: number;
    expectedPoints: number;
  }[];
}

export function WinProbabilityChart({ players }: WinProbabilityChartProps) {
  const sorted = [...players]
    .sort((a, b) => b.probFirst - a.probFirst)
    .slice(0, 10);

  const data = {
    labels: sorted.map((p) => p.name),
    datasets: [
      {
        label: "Win Tournament",
        data: sorted.map((p) => p.probFirst * 100),
        backgroundColor: "#10b981", // emerald-500
      },
      {
        label: "Top 3 (excl. 1st)",
        data: sorted.map((p) => (p.probTop3 - p.probFirst) * 100),
        backgroundColor: "#3b82f6", // blue-500
      },
    ],
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    aspectRatio: 2,
    plugins: {
      legend: {
        position: "top" as const,
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) => {
            const value = ctx.raw as number;
            return `${ctx.dataset.label}: ${value.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: "Probability (%)",
        },
      },
      y: {
        stacked: true,
      },
    },
  };

  return (
    <div className="w-full">
      <Bar data={data} options={options} />
    </div>
  );
}
