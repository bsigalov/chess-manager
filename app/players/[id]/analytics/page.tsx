"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PlayerSummaryCard, MomentumBadge, VelocityIndicator } from "@/components/features/player-summary-card";
import { AnalyticsRatingChart } from "@/components/features/analytics-rating-chart";
import { MetricCardsGrid } from "@/components/features/analytics-metric-cards";
import { ComparisonChips, type FilterType } from "@/components/features/comparison-chips";
import { TournamentGainChart } from "@/components/features/tournament-gain-chart";
import { RefreshCwIcon } from "lucide-react";
import type { PlayerAnalytics } from "@/lib/analytics/player-analytics";
import type { PlayerProfile, RatingEntry } from "@/lib/scrapers/chess-org-il";

interface AnalyticsResponse {
  profile: PlayerProfile;
  analytics: PlayerAnalytics;
  ratingHistory: RatingEntry[];
  hasDeepData: boolean;
}

interface ComparisonPlayer {
  israeliId: number;
  name: string;
  rating: number;
  analytics: PlayerAnalytics;
  ratingHistory?: RatingEntry[];
}

interface ComparisonResponse {
  primary: ComparisonPlayer;
  comparisons: ComparisonPlayer[];
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-16 w-20" />
              <Skeleton className="h-16 w-20" />
              <Skeleton className="h-16 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function PlayerAnalyticsPage() {
  const params = useParams();
  const israeliId = params.id as string;

  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Comparison state
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());
  const [comparisonPlayers, setComparisonPlayers] = useState<ComparisonPlayer[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [loadingFilter, setLoadingFilter] = useState<FilterType | undefined>();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | undefined>();
  const [enabledComparisons, setEnabledComparisons] = useState<Set<number>>(new Set());

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const res = await fetch(`/api/players/${israeliId}/analytics`, {
        signal: abortRef.current.signal,
      });
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
    }
  };

  const handleDeepScrape = async () => {
    try {
      setScraping(true);
      setError(null);

      const res = await fetch(`/api/players/${israeliId}/deep-scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depth: "full" }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      await fetchAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScraping(false);
    }
  };

  const fetchComparisonData = useCallback(async (filter: FilterType, tournamentId?: string) => {
    try {
      setComparisonLoading(true);
      setLoadingFilter(filter);

      const params = new URLSearchParams({
        primaryId: israeliId,
        filter,
      });
      if (tournamentId) {
        params.set("filterValue", tournamentId);
      }

      const res = await fetch(`/api/players/analytics-compare?${params}`);
      const json: ComparisonResponse = await res.json();

      if (!res.ok) {
        throw new Error((json as { error?: string }).error || `HTTP ${res.status}`);
      }

      // Merge new comparisons, avoiding duplicates
      setComparisonPlayers((prev) => {
        const existingIds = new Set(prev.map((p) => p.israeliId));
        const newPlayers = json.comparisons.filter((p) => !existingIds.has(p.israeliId));
        const merged = [...prev, ...newPlayers];
        // Enable all new players by default
        setEnabledComparisons((prevEnabled) => {
          const next = new Set(prevEnabled);
          newPlayers.forEach((p) => next.add(p.israeliId));
          return next;
        });
        return merged;
      });
    } catch (err) {
      console.error("Failed to fetch comparison data:", err);
    } finally {
      setComparisonLoading(false);
      setLoadingFilter(undefined);
    }
  }, [israeliId]);

  const handleToggleFilter = useCallback((filter: FilterType, tournamentId?: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (filter === "tournament") {
        if (tournamentId) {
          next.add(filter);
          setSelectedTournamentId(tournamentId);
          fetchComparisonData(filter, tournamentId);
        } else {
          next.delete(filter);
          setSelectedTournamentId(undefined);
        }
      } else if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
        fetchComparisonData(filter);
      }
      return next;
    });
  }, [fetchComparisonData]);

  const toggleComparisonPlayer = (playerId: number) => {
    setEnabledComparisons((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  useEffect(() => {
    fetchAnalytics();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [israeliId]);

  if (loading) {
    return (
      <div className="container px-4 py-8 space-y-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Players", href: "/players" },
            { label: "Analytics" },
          ]}
        />
        <AnalyticsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container px-4 py-24 flex flex-col items-center text-center gap-4">
        <h2 className="text-xl font-semibold text-destructive">Error</h2>
        <p className="text-muted-foreground max-w-md">{error}</p>
        <Button variant="outline" onClick={fetchAnalytics}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { profile, analytics, ratingHistory, hasDeepData } = data;

  // Prepare comparison players for chart (only enabled ones)
  const chartComparisonPlayers = comparisonPlayers
    .filter((p) => enabledComparisons.has(p.israeliId))
    .map((p) => ({
      name: p.name,
      israeliId: p.israeliId,
      ratingHistory: p.ratingHistory || [],
    }));

  return (
    <div className="container px-4 py-8 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Players", href: "/players" },
          { label: profile.name, href: `/players/${israeliId}` },
          { label: "Analytics" },
        ]}
      />

      {/* Header with deep scrape CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{profile.name}</h1>
          <p className="text-sm text-muted-foreground">
            Player Analytics{" "}
            {hasDeepData ? (
              <span className="text-green-600">(Full data)</span>
            ) : (
              <span className="text-yellow-600">(Basic data)</span>
            )}
          </p>
        </div>
        {!hasDeepData && (
          <Button
            variant="outline"
            size="sm"
            disabled={scraping}
            onClick={handleDeepScrape}
          >
            <RefreshCwIcon className={`mr-2 h-4 w-4 ${scraping ? "animate-spin" : ""}`} />
            {scraping ? "Scraping tournaments..." : "Deep Scrape for Full Analytics"}
          </Button>
        )}
      </div>

      {scraping && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-300">
          Scraping tournament and game history from chess.org.il. This can take 30-60 seconds...
        </div>
      )}

      {/* Player Summary Card */}
      <PlayerSummaryCard
        profile={profile}
        analytics={analytics}
        ratingHistory={ratingHistory}
      />

      {/* Comparison Filter Chips */}
      <ComparisonChips
        activeFilters={activeFilters}
        onToggleFilter={handleToggleFilter}
        isLoading={comparisonLoading}
        loadingFilter={loadingFilter}
        recentTournaments={[]} // TODO: populate from player tournament history
        selectedTournamentId={selectedTournamentId}
        comparisonCount={comparisonPlayers.filter((p) => enabledComparisons.has(p.israeliId)).length}
      />

      {/* Rating Chart with Predictions and Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rating History & Predictions</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsRatingChart
            ratingHistory={ratingHistory}
            playerName={profile.name}
            prediction3mo={analytics.prediction3mo}
            prediction6mo={analytics.prediction6mo}
            prediction12mo={analytics.prediction12mo}
            comparisonPlayers={chartComparisonPlayers}
            showMilestones={true}
            height={350}
          />
        </CardContent>
      </Card>

      {/* Comparison Player Toggles */}
      {comparisonPlayers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground mr-2 self-center">Show/hide:</span>
          {comparisonPlayers.map((player) => (
            <Button
              key={player.israeliId}
              variant={enabledComparisons.has(player.israeliId) ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => toggleComparisonPlayer(player.israeliId)}
            >
              {player.name} ({player.rating})
            </Button>
          ))}
        </div>
      )}

      {/* Comparison Table */}
      {comparisonPlayers.length > 0 && enabledComparisons.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comparison Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium">Player</th>
                    <th className="py-2 pr-4 font-medium text-right">Rating</th>
                    <th className="py-2 pr-4 font-medium text-right">Velocity</th>
                    <th className="py-2 pr-4 font-medium">Momentum</th>
                    <th className="py-2 font-medium text-right">3mo Prediction</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Primary player */}
                  <tr className="border-b border-border/50 bg-primary/5">
                    <td className="py-2 pr-4 font-medium">{profile.name} (You)</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{profile.israeliRating}</td>
                    <td className="py-2 pr-4 text-right">
                      <VelocityIndicator velocity={analytics.velocity} />
                    </td>
                    <td className="py-2 pr-4">
                      <MomentumBadge momentum={analytics.momentum} />
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {analytics.prediction3mo ? analytics.prediction3mo.rating.toFixed(0) : "—"}
                    </td>
                  </tr>
                  {/* Comparison players */}
                  {comparisonPlayers
                    .filter((p) => enabledComparisons.has(p.israeliId))
                    .map((player) => (
                      <tr key={player.israeliId} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-2 pr-4 font-medium">{player.name}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{player.rating}</td>
                        <td className="py-2 pr-4 text-right">
                          <VelocityIndicator velocity={player.analytics.velocity} />
                        </td>
                        <td className="py-2 pr-4">
                          <MomentumBadge momentum={player.analytics.momentum} />
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {player.analytics.prediction3mo
                            ? player.analytics.prediction3mo.rating.toFixed(0)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric Cards Grid */}
      <MetricCardsGrid
        analytics={analytics}
        currentRating={profile.israeliRating}
        hasDeepData={hasDeepData}
        onRequestScrape={handleDeepScrape}
        isScraping={scraping}
      />

      {/* Predictions Section */}
      {(analytics.prediction3mo || analytics.prediction6mo || analytics.prediction12mo) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rating Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {analytics.prediction3mo && (
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums">
                    {analytics.prediction3mo.rating.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    3 months ({analytics.prediction3mo.low.toFixed(0)} - {analytics.prediction3mo.high.toFixed(0)})
                  </div>
                </div>
              )}
              {analytics.prediction6mo && (
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums">
                    {analytics.prediction6mo.rating.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    6 months ({analytics.prediction6mo.low.toFixed(0)} - {analytics.prediction6mo.high.toFixed(0)})
                  </div>
                </div>
              )}
              {analytics.prediction12mo && (
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums">
                    {analytics.prediction12mo.rating.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    12 months ({analytics.prediction12mo.low.toFixed(0)} - {analytics.prediction12mo.high.toFixed(0)})
                  </div>
                </div>
              )}
            </div>
            {analytics.prediction3mo && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                R² fit: {(analytics.prediction3mo.r2 * 100).toFixed(1)}%
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tournament Gains - only show with deep data */}
      {hasDeepData && analytics.tournamentGains && analytics.tournamentGains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tournament Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div>
                <span className="text-2xl font-bold tabular-nums">
                  {analytics.avgRatingGainPerTournament !== null
                    ? (analytics.avgRatingGainPerTournament >= 0 ? "+" : "") +
                      analytics.avgRatingGainPerTournament.toFixed(1)
                    : "—"}
                </span>
                <span className="ml-2 text-sm text-muted-foreground">avg pts/tournament</span>
              </div>
            </div>
            <TournamentGainChart
              tournamentGains={analytics.tournamentGains}
              avgGain={analytics.avgRatingGainPerTournament}
              height={200}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
