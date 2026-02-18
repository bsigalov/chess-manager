"use client";

import Link from "next/link";
import { useFollowedPlayers } from "@/components/providers/followed-players-provider";
import { Heart } from "lucide-react";

export function MyPlayersSection() {
  const { followedPlayers, loading } = useFollowedPlayers();

  if (loading || followedPlayers.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Heart className="h-5 w-5 fill-red-500 text-red-500" />
        My Players
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {followedPlayers.map((player) => {
          const latest = player.recentTournaments[0];
          return (
            <Link
              key={player.id}
              href={`/players/${player.id}`}
              className="block rounded-lg border p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium truncate">
                  {player.title && (
                    <span className="text-amber-600 dark:text-amber-400 mr-1 text-sm">
                      {player.title}
                    </span>
                  )}
                  {player.name}
                </p>
                {player.rating && (
                  <span className="text-sm text-muted-foreground shrink-0 ml-2">
                    {player.rating}
                  </span>
                )}
              </div>
              {latest && (
                <div className="text-sm text-muted-foreground">
                  <p className="truncate">{latest.tournamentName}</p>
                  <div className="flex gap-3 mt-1 text-xs">
                    {latest.points != null && <span>{latest.points} pts</span>}
                    {latest.currentRank && <span>Rank #{latest.currentRank}</span>}
                    {latest.performance && <span>Perf {latest.performance}</span>}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
