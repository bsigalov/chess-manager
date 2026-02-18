"use client";

interface ProbabilityBarProps {
  win: number;
  draw: number;
  loss: number;
}

export function ProbabilityBar({ win, draw, loss }: ProbabilityBarProps) {
  const winPct = Math.round(win * 100);
  const drawPct = Math.round(draw * 100);
  const lossPct = Math.round(loss * 100);

  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full"
      title={`W: ${winPct}% D: ${drawPct}% L: ${lossPct}%`}
    >
      {winPct > 0 && (
        <div
          className="bg-emerald-500"
          style={{ width: `${winPct}%` }}
        />
      )}
      {drawPct > 0 && (
        <div
          className="bg-amber-500"
          style={{ width: `${drawPct}%` }}
        />
      )}
      {lossPct > 0 && (
        <div
          className="bg-red-500"
          style={{ width: `${lossPct}%` }}
        />
      )}
    </div>
  );
}
