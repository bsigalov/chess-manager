"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search, ChevronLeft, ChevronRight, Heart } from "lucide-react";

interface Player {
  id: string;
  name: string;
  title: string | null;
  rating: number | null;
  country: string | null;
  fideId: string | null;
  aliases?: { alias: string }[];
}

interface PlayersPageClientProps {
  totalCount: number;
}

const PAGE_SIZE = 50;

export function PlayersPageClient({ totalCount }: PlayersPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize state from URL
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get("q") ?? "");
  const [page, setPage] = useState(
    Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  );
  const [showFollowed, setShowFollowed] = useState(searchParams.get("followed") === "true");
  const [players, setPlayers] = useState<Player[]>([]);
  const [total, setTotal] = useState(totalCount);
  const [loading, setLoading] = useState(true);

  // Sync state → URL
  const updateUrl = useCallback(
    (q: string, p: number, followed: boolean) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (p > 1) params.set("page", String(p));
      if (followed) params.set("followed", "true");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router]
  );

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
      updateUrl(query, 1, showFollowed);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Sync page changes to URL
  useEffect(() => {
    updateUrl(debouncedQuery, page, showFollowed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (debouncedQuery.trim()) {
        params.set("q", debouncedQuery.trim());
      }
      if (showFollowed) {
        params.set("followed", "true");
      }
      const res = await fetch(`/api/players?${params}`);
      const data = await res.json();
      setPlayers(data.players ?? []);
      setTotal(data.pagination?.total ?? 0);
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, showFollowed]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleFollowed = () => {
    const next = !showFollowed;
    setShowFollowed(next);
    setPage(1);
    updateUrl(debouncedQuery, 1, next);
  };

  return (
    <div className="container px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-muted-foreground" />
          <h1 className="text-3xl font-bold tracking-tight">Players</h1>
        </div>
        <span className="text-sm text-muted-foreground">
          {total.toLocaleString()} players
        </span>
      </div>
      <p className="text-muted-foreground mb-6 ml-10">
        All players imported from chess-results.com tournaments.
      </p>

      {/* Search + Favorites filter */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID or FIDE ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showFollowed ? "default" : "outline"}
          size="icon"
          onClick={toggleFollowed}
          title={showFollowed ? "Show all players" : "Show followed only"}
        >
          <Heart className={`h-4 w-4 ${showFollowed ? "fill-current" : ""}`} />
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-md border p-12 text-center text-muted-foreground">
          Loading…
        </div>
      ) : players.length === 0 ? (
        <div className="rounded-md border p-12 text-center text-muted-foreground">
          {showFollowed
            ? "No followed players found."
            : `No players match "${query}"`}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">Player</th>
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Rating</th>
                <th className="px-4 py-3 text-left font-medium">Fed</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, i) => (
                <tr key={player.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2 text-muted-foreground tabular-nums">
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/players/${player.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {player.name}
                    </Link>
                    {player.aliases && player.aliases.length > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {player.aliases[0].alias}
                      </span>
                    )}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
