"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Search } from "lucide-react";

interface Player {
  id: string;
  name: string;
  title: string | null;
  rating: number | null;
  country: string | null;
  fideId: string | null;
  _count: { tournaments: number };
}

interface PlayersPageClientProps {
  players: Player[];
}

export function PlayersPageClient({ players }: PlayersPageClientProps) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? players.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.fideId && p.fideId.toLowerCase().includes(q))
      )
    : players;

  return (
    <div className="container px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-muted-foreground" />
          <h1 className="text-3xl font-bold tracking-tight">Players</h1>
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length === players.length
            ? `${players.length} players`
            : `${filtered.length} of ${players.length} players`}
        </span>
      </div>
      <p className="text-muted-foreground mb-6 ml-10">
        All players imported from chess-results.com tournaments.
      </p>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, ID or FIDE ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-md border p-12 text-center text-muted-foreground">
          No players match &quot;{query}&quot;
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Player</th>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Rating</th>
                <th className="px-4 py-3 text-left font-medium">Fed</th>
                <th className="px-4 py-3 text-left font-medium">Tournaments</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((player) => (
                <tr key={player.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2">
                    <Link
                      href={`/players/${player.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {player.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {player.title && (
                      <Badge variant="outline" className="text-xs">
                        {player.title}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{player.rating ?? "—"}</td>
                  <td className="px-4 py-2">{player.country ?? ""}</td>
                  <td className="px-4 py-2 text-muted-foreground tabular-nums">
                    {player._count.tournaments}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
