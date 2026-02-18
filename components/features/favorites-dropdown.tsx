"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFollowedPlayers } from "@/components/providers/followed-players-provider";

export function FavoritesDropdown() {
  const { followedPlayers, loading } = useFollowedPlayers();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Followed players"
        className="relative"
      >
        <Heart className={`h-4 w-4 ${followedPlayers.length > 0 ? "fill-red-500 text-red-500" : ""}`} />
        {followedPlayers.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {followedPlayers.length}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Followed Players</h3>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : followedPlayers.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No followed players yet
              </div>
            ) : (
              followedPlayers.map((player) => {
                const latest = player.recentTournaments[0];
                return (
                  <Link
                    key={player.id}
                    href={`/players/${player.id}`}
                    className="block px-4 py-3 border-b last:border-0 hover:bg-accent/50 transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {player.title && (
                            <span className="text-amber-600 dark:text-amber-400 mr-1">
                              {player.title}
                            </span>
                          )}
                          {player.name}
                        </p>
                        {player.rating && (
                          <p className="text-xs text-muted-foreground">{player.rating}</p>
                        )}
                      </div>
                      {latest && (
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-xs font-medium">
                            {latest.points != null ? `${latest.points} pts` : ""}
                          </p>
                          {latest.currentRank && (
                            <p className="text-[10px] text-muted-foreground">
                              #{latest.currentRank}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {latest && (
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">
                        {latest.tournamentName}
                      </p>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
