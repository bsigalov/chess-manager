"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StandingsTable } from "@/components/features/standings-table";
import { PairingsView } from "@/components/features/pairings-view";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CopyLinkButton } from "@/components/features/copy-link-button";
import { CrosstableView } from "@/components/features/crosstable-view";
import { PredictionsPanel } from "@/components/features/predictions-panel";
import { MagicNumbers } from "@/components/features/magic-numbers";
import { WhatIfPanel } from "@/components/features/what-if-panel";
import { ScoreTrajectoryChart } from "@/components/features/score-trajectory-chart";
import { WinProbabilityChart } from "@/components/features/win-probability-chart";
import type { CrosstableEntry, SimulationResult } from "@/lib/types/tournament";
import { useFollowedPlayers } from "@/components/providers/followed-players-provider";
import {
  MapPin,
  Users,
  RefreshCw,
  Loader2,
  Download,
  FileText,
  FileSpreadsheet,
  Heart,
} from "lucide-react";

interface TournamentData {
  id: string;
  name: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  startDate: string;
  endDate: string;
  rounds: number;
  currentRound: number;
  status: string;
  playerCount: number;
  standings: {
    playerId: string;
    rank: number;
    name: string;
    title: string | null;
    rating: number | null;
    federation: string | null;
    points: number;
    performance: number | null;
    buchholz?: number | null;
    sonnebornBerger?: number | null;
  }[];
  pairings: Record<
    number,
    {
      board: number;
      whitePlayerId: string | null;
      whiteName: string;
      whiteTitle?: string | null;
      blackPlayerId: string | null;
      blackName: string;
      blackTitle?: string | null;
      whiteRating: number | null;
      blackRating: number | null;
      result: string | null;
      pairingId?: string | null;
    }[]
  >;
}

interface AnalyticsData {
  crosstable: CrosstableEntry[];
  simulation: SimulationResult | null;
  playerStats: {
    name: string;
    scoreProgression: number[];
  }[];
}

export function TournamentDetail({
  tournament,
}: {
  tournament: TournamentData;
}) {
  const [showOnlyFollowed, setShowOnlyFollowed] = useState(false);
  const { followedPlayerIds } = useFollowedPlayers();
  const [refreshing, setRefreshing] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "standings";

  function updateSearchParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const loadAnalytics = useCallback(async () => {
    if (analyticsLoaded || analyticsLoading) return;
    setAnalyticsLoading(true);
    try {
      const [ctRes, anRes] = await Promise.all([
        fetch(`/api/tournaments/${tournament.id}/crosstable`),
        fetch(`/api/tournaments/${tournament.id}/analytics`),
      ]);
      if (!ctRes.ok || !anRes.ok) throw new Error("Failed to load analytics");
      const ctData = await ctRes.json();
      const anData = await anRes.json();
      setAnalytics({
        crosstable: ctData.crosstable || [],
        simulation: anData.simulation || null,
        playerStats: anData.playerStats || [],
      });
      setAnalyticsLoaded(true);
    } catch {
      toast.error("Failed to load analytics data");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [tournament.id, analyticsLoaded, analyticsLoading]);

  const location = [tournament.city, tournament.country]
    .filter(Boolean)
    .join(", ");
  const dates = `${new Date(tournament.startDate).toLocaleDateString()} – ${new Date(tournament.endDate).toLocaleDateString()}`;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/refresh`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast.success("Tournament data refreshed");
      router.refresh();
    } catch {
      toast.error("Failed to refresh tournament");
    } finally {
      setRefreshing(false);
    }
  }

  function handleExport(format: "csv" | "pgn" | "pdf") {
    setExportOpen(false);
    window.open(`/api/tournaments/${tournament.id}/export/${format}`, "_blank");
  }

  return (
    <div className="container px-4 py-8">
      <Breadcrumbs
        items={[
          { label: "Tournaments", href: "/" },
          { label: tournament.name },
        ]}
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <Badge
              variant={
                tournament.status === "completed" ? "secondary" : "default"
              }
            >
              {tournament.status === "completed" ? "Completed" : "Live"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
            )}
            <span>{dates}</span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {tournament.playerCount} players
            </span>
            <span>
              Round {tournament.currentRound}/{tournament.rounds}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(!exportOpen)}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-40 rounded-md border bg-popover p-1 shadow-md z-50">
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent transition-colors"
                  onClick={() => handleExport("csv")}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent transition-colors"
                  onClick={() => handleExport("pgn")}
                >
                  <FileText className="h-4 w-4" />
                  PGN
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent transition-colors"
                  onClick={() => handleExport("pdf")}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </button>
              </div>
            )}
          </div>

          <CopyLinkButton />

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue={initialTab}
        onValueChange={(v) => {
          updateSearchParam("tab", v);
          if (["crosstable", "analytics", "whatif"].includes(v)) {
            loadAnalytics();
          }
        }}
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="pairings">Pairings</TabsTrigger>
          <TabsTrigger value="crosstable">Crosstable</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          {tournament.status !== "completed" && (
            <TabsTrigger value="whatif">What If</TabsTrigger>
          )}
          <TabsTrigger value="players">Players</TabsTrigger>
        </TabsList>
        {followedPlayerIds.size > 0 && (
          <Button
            variant={showOnlyFollowed ? "default" : "outline"}
            size="sm"
            className="ml-2"
            onClick={() => setShowOnlyFollowed(!showOnlyFollowed)}
          >
            <Heart className={`h-3.5 w-3.5 mr-1 ${showOnlyFollowed ? "fill-current" : ""}`} />
            My Players
          </Button>
        )}
        <TabsContent value="standings" className="mt-4">
          <StandingsTable
            standings={tournament.standings}
            tournamentId={tournament.id}
            showOnlyFollowed={showOnlyFollowed}
          />
        </TabsContent>
        <TabsContent value="pairings" className="mt-4">
          <PairingsView
            pairings={tournament.pairings}
            totalRounds={tournament.rounds}
            currentRound={tournament.currentRound}
            tournamentId={tournament.id}
            showOnlyFollowed={showOnlyFollowed}
          />
        </TabsContent>
        <TabsContent value="crosstable" className="mt-4">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading crosstable...
            </div>
          ) : analytics?.crosstable ? (
            <CrosstableView
              crosstable={analytics.crosstable}
              tournamentId={tournament.id}
            />
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No crosstable data available
            </p>
          )}
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Computing analytics...
            </div>
          ) : analytics ? (
            <div className="space-y-8">
              {analytics.crosstable.length > 0 && (
                <MagicNumbers
                  crosstable={analytics.crosstable}
                  totalRounds={tournament.rounds}
                />
              )}
              <PredictionsPanel simulation={analytics.simulation} />
              {analytics.simulation && (
                <WinProbabilityChart
                  players={analytics.simulation.players}
                />
              )}
              {analytics.playerStats.length > 0 && (
                <ScoreTrajectoryChart
                  players={analytics.playerStats}
                  totalRounds={tournament.rounds}
                />
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Select this tab to load analytics
            </p>
          )}
        </TabsContent>
        {tournament.status !== "completed" && (
          <TabsContent value="whatif" className="mt-4">
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading...
              </div>
            ) : analytics?.crosstable ? (
              <WhatIfPanel
                tournamentId={tournament.id}
                crosstable={analytics.crosstable}
                totalRounds={tournament.rounds}
              />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No crosstable data available
              </p>
            )}
          </TabsContent>
        )}
        <TabsContent value="players" className="mt-4">
          <div className="rounded-md border overflow-x-auto max-w-3xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="hidden md:table-cell">Fed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...tournament.standings]
                  .sort((a, b) => a.rank - b.rank)
                  .map((entry) => (
                    <TableRow key={entry.playerId}>
                      <TableCell className="tabular-nums">{entry.rank}</TableCell>
                      <TableCell>
                        <Link
                          href={`/tournaments/${tournament.id}/players/${entry.playerId}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {entry.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.title || ""}
                      </TableCell>
                      <TableCell className="tabular-nums">{entry.rating ?? "\u2014"}</TableCell>
                      <TableCell className="hidden md:table-cell">{entry.federation ?? ""}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
