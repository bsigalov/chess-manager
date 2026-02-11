"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Pairing {
  board: number;
  whiteName: string;
  blackName: string;
  whiteRating: number | null;
  blackRating: number | null;
  result: string | null;
}

interface PairingsViewProps {
  pairings: Record<number, Pairing[]>;
  totalRounds: number;
  currentRound: number;
  loading?: boolean;
}

function resultColor(result: string | null, side: "white" | "black") {
  if (!result) return "";
  if (result === "1/2-1/2") return "text-amber-500";
  if ((result === "1-0" && side === "white") || (result === "0-1" && side === "black")) {
    return "text-emerald-500 font-bold";
  }
  return "text-red-500";
}

export function PairingsView({
  pairings,
  totalRounds,
  currentRound,
  loading,
}: PairingsViewProps) {
  const [round, setRound] = useState(currentRound || 1);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const roundPairings = pairings[round] || [];

  return (
    <div className="space-y-4">
      {/* Round selector */}
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
          <Button
            key={r}
            variant={r === round ? "default" : "outline"}
            size="sm"
            onClick={() => setRound(r)}
            disabled={!pairings[r]}
          >
            {r}
          </Button>
        ))}
      </div>

      {/* Pairings */}
      {roundPairings.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          No pairings available for round {round}
        </p>
      ) : (
        <div className="space-y-2">
          {roundPairings.map((p) => (
            <div
              key={p.board}
              className="flex items-center border rounded-lg p-3 gap-2"
            >
              <span className="text-xs text-muted-foreground w-8 shrink-0">
                Bd {p.board}
              </span>
              <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                <span
                  className={`truncate ${resultColor(p.result, "white")}`}
                >
                  {p.whiteName}
                  {p.whiteRating && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({p.whiteRating})
                    </span>
                  )}
                </span>
                <span className="text-xs font-mono shrink-0 px-2 py-1 bg-muted rounded">
                  {p.result || "—"}
                </span>
                <span
                  className={`truncate text-right ${resultColor(p.result, "black")}`}
                >
                  {p.blackName}
                  {p.blackRating && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({p.blackRating})
                    </span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
