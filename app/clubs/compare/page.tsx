"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClubRatingChart } from "@/components/features/club-rating-chart";

interface RatingEntry {
  period: string;
  rating: number;
  recordedAt: string;
}

interface PlayerData {
  israeliId: number;
  name: string;
  birthYear?: number;
  rating: number;
  fideRating?: number;
  ratingHistory: RatingEntry[];
}

interface ClubResponse {
  clubName: string;
  players: PlayerData[];
  scrapedAt: string;
  fromCache?: boolean;
  cacheAgeHours?: number;
  error?: string;
}

const CLUB_ID = "155"; // צפריר הובר רחובות

function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <span className="tabular-nums">
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

export default function ClubComparePage() {
  const [data, setData] = useState<ClubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const url = `/api/clubs/${CLUB_ID}/players${refresh ? "?refresh=1" : ""}`;
      const res = await fetch(url, { signal: abortRef.current.signal });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setData(json);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, []);

  if (loading) {
    return (
      <div className="container px-4 py-24 flex flex-col items-center text-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <h2 className="text-xl font-semibold">Loading club data...</h2>
        <p className="text-muted-foreground max-w-md">
          First load scrapes chess.org.il for all club members and their rating
          histories. This takes 2-5 minutes due to rate limiting.
        </p>
        <p className="text-sm text-muted-foreground">
          Elapsed: <ElapsedTimer />
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container px-4 py-24 flex flex-col items-center text-center gap-4">
        <h2 className="text-xl font-semibold text-destructive">Error</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => fetchData()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const playersWithHistory = data.players.filter(
    (p) => p.ratingHistory.length > 0
  );

  return (
    <div className="container px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{data.clubName}</h1>
          <p className="text-sm text-muted-foreground">
            Rating Comparison — {data.players.length} active players
            {data.fromCache && data.cacheAgeHours !== undefined && (
              <span className="ml-2">
                (cached {data.cacheAgeHours}h ago)
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => fetchData(true)}
        >
          {refreshing ? "Scraping..." : "Refresh Data"}
        </Button>
      </div>

      {refreshing && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-300">
          Scraping chess.org.il for all club members. This can take several
          minutes due to rate limiting...
        </div>
      )}

      {/* Chart */}
      {playersWithHistory.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rating History</CardTitle>
          </CardHeader>
          <CardContent>
            <ClubRatingChart players={playersWithHistory} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No rating history available. Try refreshing the data.
          </CardContent>
        </Card>
      )}

      {/* Player summary table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Players</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium text-right">Rating</th>
                  <th className="py-2 pr-4 font-medium text-right">FIDE</th>
                  <th className="py-2 pr-4 font-medium text-right">
                    Birth Year
                  </th>
                  <th className="py-2 font-medium text-right">History Pts</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((player, idx) => (
                  <tr
                    key={player.israeliId}
                    className="border-b border-border/50 hover:bg-muted/50"
                  >
                    <td className="py-2 pr-4 text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="py-2 pr-4 font-medium">{player.name}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {player.rating}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {player.fideRating || "—"}
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {player.birthYear || "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {player.ratingHistory.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
