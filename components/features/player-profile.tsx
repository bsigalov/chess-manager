"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FollowButton } from "@/components/features/follow-button";
import {
  Flag,
  Trophy,
  TrendingUp,
  Calendar,
  Shield,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { OpeningStats } from "@/components/features/opening-stats";
import { TournamentComparisonChart } from "@/components/features/tournament-comparison-chart";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTooltip,
  Legend,
  Filler
);

interface TournamentEntry {
  tournamentId: string;
  tournamentName: string;
  city: string | null;
  country: string | null;
  startDate: string;
  endDate: string;
  rounds: number;
  status: string;
  startingRank: number | null;
  currentRank: number | null;
  startingRating: number | null;
  currentRating: number | null;
  points: number;
  performance: number | null;
}

interface RatingEntry {
  id: string;
  ratingType: string;
  rating: number;
  source: string;
  recordedAt: string;
}

interface AliasEntry {
  id: string;
  alias: string;
  source: string;
}

// ─── Rating History Tab ──────────────────────────────────────────────────────

const RATING_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; fill: string }
> = {
  standard: { label: "Standard", color: "#3b82f6", fill: "rgba(59,130,246,0.1)" },
  rapid:    { label: "Rapid",    color: "#8b5cf6", fill: "rgba(139,92,246,0.1)" },
  blitz:    { label: "Blitz",    color: "#f59e0b", fill: "rgba(245,158,11,0.1)" },
  israeli:  { label: "🇮🇱 Israeli", color: "#10b981", fill: "rgba(16,185,129,0.1)" },
};

function formatPeriod(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function matchTournamentsToPeriods(
  tableEntries: { id: string; recordedAt: string }[],
  tournaments: TournamentEntry[]
): Map<string, TournamentEntry[]> {
  const result = new Map<string, TournamentEntry[]>();
  for (let i = 0; i < tableEntries.length; i++) {
    const periodEnd = new Date(tableEntries[i].recordedAt).getTime();
    const periodStart = i < tableEntries.length - 1
      ? new Date(tableEntries[i + 1].recordedAt).getTime()
      : 0;
    const matched = tournaments.filter((t) => {
      const end = new Date(t.endDate).getTime();
      return end > periodStart && end <= periodEnd;
    }).sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
    result.set(tableEntries[i].id, matched);
  }
  return result;
}

function RatingHistoryTab({ ratingHistory, tournaments }: { ratingHistory: RatingEntry[]; tournaments: TournamentEntry[] }) {
  const types = Array.from(new Set(ratingHistory.map((r) => r.ratingType)));
  const [activeType, setActiveType] = useState<string>(types[0] ?? "standard");

  if (ratingHistory.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No rating history available.
      </div>
    );
  }

  // Per-type summary stats
  const summaries = types.map((type) => {
    const entries = [...ratingHistory.filter((r) => r.ratingType === type)].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    const latest = entries[entries.length - 1];
    const oldest = entries[0];
    const change = latest.rating - oldest.rating;
    const peak = Math.max(...entries.map((e) => e.rating));
    return { type, latest, oldest, change, peak, count: entries.length };
  });

  // Chart data for the active type
  const activeEntries = [...ratingHistory.filter((r) => r.ratingType === activeType)].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
  const cfg = RATING_TYPE_CONFIG[activeType] ?? RATING_TYPE_CONFIG.standard;

  const chartData = {
    labels: activeEntries.map((e) => formatPeriod(e.recordedAt)),
    datasets: [
      {
        label: cfg.label,
        data: activeEntries.map((e) => e.rating),
        borderColor: cfg.color,
        backgroundColor: cfg.fill,
        borderWidth: 2,
        pointRadius: activeEntries.length > 40 ? 2 : 4,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const minRating = Math.min(...activeEntries.map((e) => e.rating));
  const maxRating = Math.max(...activeEntries.map((e) => e.rating));
  const padding = Math.max(30, Math.round((maxRating - minRating) * 0.15));

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => items[0].label,
          label: (item) => ` Rating: ${item.parsed.y}`,
          afterLabel: (item) => {
            const idx = item.dataIndex;
            if (idx === 0) return "";
            const delta = activeEntries[idx].rating - activeEntries[idx - 1].rating;
            return ` Change: ${delta > 0 ? "+" : ""}${delta}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 12,
          maxRotation: 45,
          font: { size: 11 },
        },
        grid: { display: false },
      },
      y: {
        min: minRating - padding,
        max: maxRating + padding,
        ticks: { font: { size: 11 } },
        grid: { color: "rgba(128,128,128,0.1)" },
      },
    },
  };

  // Table with delta column — newest first
  const tableEntries = [...ratingHistory.filter((r) => r.ratingType === activeType)].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );
  const tableWithDelta = tableEntries.map((entry, idx) => {
    const next = tableEntries[idx + 1]; // next = older record
    const delta = next ? entry.rating - next.rating : null;
    return { ...entry, delta };
  });

  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());
  const periodTournaments = matchTournamentsToPeriods(tableEntries, tournaments);

  function togglePeriod(id: string) {
    setExpandedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map(({ type, latest, change, peak, count }) => {
          const c = RATING_TYPE_CONFIG[type] ?? RATING_TYPE_CONFIG.standard;
          const isActive = type === activeType;
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`text-left rounded-lg border p-4 transition-all hover:shadow-md ${
                isActive ? "" : "opacity-70 hover:opacity-100"
              }`}
              style={isActive ? { outline: `2px solid ${c.color}`, borderColor: c.color } : {}}
            >
              <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
              <div className="text-2xl font-bold tabular-nums">{latest.rating}</div>
              <div className="flex items-center justify-between mt-1 text-xs">
                <span
                  className={
                    change > 0
                      ? "text-green-600 dark:text-green-400"
                      : change < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                  }
                >
                  {change > 0 ? "▲" : change < 0 ? "▼" : "—"}{" "}
                  {Math.abs(change)} all-time
                </span>
                <span className="text-muted-foreground">Peak: {peak}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{count} records</div>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {cfg.label} Rating over time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ height: 260 }}>
            <Line data={chartData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="hidden sm:table-cell text-muted-foreground">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableWithDelta.map((rh) => {
              const isExpanded = expandedPeriods.has(rh.id);
              const matched = periodTournaments.get(rh.id) ?? [];
              return (
                <>
                  <TableRow
                    key={rh.id}
                    onClick={() => togglePeriod(rh.id)}
                    className={`cursor-pointer select-none ${
                      rh.delta != null && rh.delta > 0
                        ? "bg-green-50/40 dark:bg-green-950/20"
                        : rh.delta != null && rh.delta < 0
                          ? "bg-red-50/40 dark:bg-red-950/20"
                          : ""
                    }`}
                  >
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <ChevronRight
                          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                        />
                        {formatPeriod(rh.recordedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                      {rh.rating}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rh.delta == null ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : rh.delta === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : (
                        <span
                          className={
                            rh.delta > 0
                              ? "text-green-600 dark:text-green-400 font-medium"
                              : "text-red-600 dark:text-red-400 font-medium"
                          }
                        >
                          {rh.delta > 0 ? "+" : ""}{rh.delta}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                      {rh.source}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${rh.id}-details`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={4} className="p-0">
                        {matched.length === 0 ? (
                          <div className="px-8 py-3 text-sm text-muted-foreground italic">
                            No tracked tournaments in this period
                          </div>
                        ) : (
                          <div className="divide-y">
                            {matched.map((t) => {
                              const ratingDelta = t.currentRating && t.startingRating
                                ? t.currentRating - t.startingRating
                                : null;
                              const href = t.startingRank != null
                                ? `/tournaments/${t.tournamentId}/players/${t.startingRank}`
                                : `/tournaments/${t.tournamentId}`;
                              return (
                                <Link
                                  key={t.tournamentId}
                                  href={href}
                                  className="flex items-center justify-between gap-4 px-8 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Trophy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="truncate font-medium">{t.tournamentName}</span>
                                  </div>
                                  <div className="flex items-center gap-4 shrink-0 text-xs">
                                    <span className="text-muted-foreground tabular-nums">
                                      {t.points}/{t.rounds}
                                    </span>
                                    {ratingDelta != null && (
                                      <span
                                        className={`tabular-nums font-medium ${
                                          ratingDelta > 0
                                            ? "text-green-600 dark:text-green-400"
                                            : ratingDelta < 0
                                              ? "text-red-600 dark:text-red-400"
                                              : "text-muted-foreground"
                                        }`}
                                      >
                                        {ratingDelta > 0 ? "+" : ""}{ratingDelta}
                                      </span>
                                    )}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface IsraeliMetadata {
  israeliId?: number;
  israeliRating?: number;
  israeliRank?: number;
  cardValidUntil?: string;
  club?: string;
  source?: string;
}

interface PlayerData {
  id: string;
  fideId: string | null;
  name: string;
  title: string | null;
  rating: number | null;
  rapidRating: number | null;
  blitzRating: number | null;
  country: string | null;
  birthYear: number | null;
  isActive: boolean;
  isClaimed: boolean;
  metadata: Record<string, unknown> | null;
  tournaments: TournamentEntry[];
  ratingHistory: RatingEntry[];
  aliases: AliasEntry[];
}

interface PlayerProfileProps {
  player: PlayerData;
  isFollowing: boolean;
  claimStatus: string | null;
}

export function PlayerProfile({
  player,
  isFollowing,
  claimStatus,
}: PlayerProfileProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [claiming, setClaiming] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const activeTab = searchParams.get("tab") ?? "overview";
  const updateTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(`?${qs}`, { scroll: false });
  };

  const titleDisplay = player.title ? `${player.title} ` : "";
  const il = (player.metadata ?? {}) as IsraeliMetadata;
  const isIsraeli = il.source === "chess-org-il";

  async function handleClaim() {
    if (!session?.user) {
      router.push("/auth/signin");
      return;
    }

    setClaiming(true);
    try {
      const res = await fetch(`/api/players/${player.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationType: "fide_email",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit claim");
      }

      toast.success("Claim submitted. We will review it shortly.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit claim"
      );
    } finally {
      setClaiming(false);
    }
  }

  // Stats calculations
  const totalTournaments = player.tournaments.length;
  const avgPerformance =
    player.tournaments.filter((t) => t.performance != null).length > 0
      ? Math.round(
          player.tournaments
            .filter((t) => t.performance != null)
            .reduce((sum, t) => sum + t.performance!, 0) /
            player.tournaments.filter((t) => t.performance != null).length
        )
      : null;

  return (
    <div className="container px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">
              {titleDisplay}
              {player.name}
            </h1>
            {player.isActive ? (
              <Badge>Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          {player.aliases.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {player.aliases.map((a) => a.alias).join(" · ")}
            </p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {player.country && (
              <span className="flex items-center gap-1">
                <Flag className="h-3 w-3" />
                {player.country}
              </span>
            )}
            {player.fideId && (
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                FIDE ID: {player.fideId}
              </span>
            )}
            {player.birthYear && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Born {player.birthYear}
              </span>
            )}
            {isIsraeli && il.israeliRank && (
              <span className="flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Israeli rank #{il.israeliRank}
              </span>
            )}
            {isIsraeli && il.club && (
              <span className="flex items-center gap-1 max-w-xs truncate" title={il.club}>
                {il.club}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FollowButton playerId={player.id} initialFollowed={isFollowing} />
          {isIsraeli && il.israeliId && (
            <Link
              href={`/players/${il.israeliId}/analytics`}
              className="inline-flex items-center gap-1 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
            >
              <TrendingUp className="h-4 w-4" />
              Analytics
            </Link>
          )}
          {(() => {
            const params = new URLSearchParams();
            if (player.name.includes(", ")) {
              const [last, first] = player.name.split(", ");
              if (last) params.set("lastName", last);
              if (first) params.set("firstName", first);
            } else {
              const parts = player.name.trim().split(" ");
              const last = parts[parts.length - 1];
              const first = parts.slice(0, -1).join(" ");
              if (last) params.set("lastName", last);
              if (first) params.set("firstName", first);
            }
            if (player.fideId) params.set("fideId", player.fideId);
            return (
              <Link
                href={`/players/search?${params.toString()}`}
                className="inline-flex items-center gap-1 text-sm border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
              >
                Find on chess-results.com
              </Link>
            );
          })()}
          {!player.isClaimed && !claimStatus && session?.user && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Shield className="h-4 w-4 mr-1" />
              )}
              Claim Profile
            </Button>
          )}
          {claimStatus === "pending" && (
            <Badge variant="outline">Claim Pending</Badge>
          )}
          {claimStatus === "approved" && (
            <Badge variant="default">Verified</Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={updateTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tournaments">
            Tournaments ({totalTournaments})
          </TabsTrigger>
          <TabsTrigger value="openings">Openings</TabsTrigger>
          <TabsTrigger value="ratings">Rating History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Standard Rating</CardDescription>
                <CardTitle className="text-3xl">
                  {player.rating ?? "N/A"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Rapid Rating</CardDescription>
                <CardTitle className="text-3xl">
                  {player.rapidRating ?? "N/A"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Blitz Rating</CardDescription>
                <CardTitle className="text-3xl">
                  {player.blitzRating ?? "N/A"}
                </CardTitle>
              </CardHeader>
            </Card>
            {isIsraeli && il.israeliRating ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Israeli Rating</CardDescription>
                  <CardTitle className="text-3xl">{il.israeliRating}</CardTitle>
                </CardHeader>
                {il.cardValidUntil && (
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Card valid until{" "}
                      {new Date(il.cardValidUntil).toLocaleDateString()}
                    </p>
                  </CardContent>
                )}
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg Performance</CardDescription>
                  <CardTitle className="text-3xl">
                    {avgPerformance ?? "N/A"}
                  </CardTitle>
                </CardHeader>
              </Card>
            )}
          </div>

          {/* Quick stats */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Tournament Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      Total Tournaments
                    </dt>
                    <dd className="font-medium">{totalTournaments}</dd>
                  </div>
                  {player.tournaments.length > 0 && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Best Rank</dt>
                        <dd className="font-medium">
                          #
                          {Math.min(
                            ...player.tournaments
                              .map((t) => t.currentRank)
                              .filter((r): r is number => r != null)
                          ) || "N/A"}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">
                          Best Performance
                        </dt>
                        <dd className="font-medium">
                          {Math.max(
                            ...player.tournaments
                              .map((t) => t.performance)
                              .filter((p): p is number => p != null)
                          ) || "N/A"}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>

            {player.aliases.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Known Aliases</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {player.aliases.map((alias) => (
                      <li
                        key={alias.id}
                        className="flex items-center justify-between"
                      >
                        <span>{alias.alias}</span>
                        <span className="text-xs text-muted-foreground">
                          {alias.source}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent tournaments */}
          {player.tournaments.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">
                Recent Tournaments
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {player.tournaments.slice(0, 6).map((t) => (
                  <Link
                    key={t.tournamentId}
                    href={`/tournaments/${t.tournamentId}`}
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm leading-tight">
                          {t.tournamentName}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(t.startDate).toLocaleDateString()}
                          {t.city && ` - ${t.city}`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {t.currentRank && <span>Rank #{t.currentRank}</span>}
                          <span>{t.points} pts</span>
                          {t.performance && (
                            <span className="flex items-center gap-0.5">
                              <TrendingUp className="h-3 w-3" />
                              {t.performance}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tournaments Tab */}
        <TabsContent value="tournaments" className="mt-4">
          {player.tournaments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No tournament history found.
            </div>
          ) : (
            <>
            {player.tournaments.length > 1 && (
              <div className="mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChart(!showChart)}
                >
                  {showChart ? "Hide Chart" : "Show Comparison Chart"}
                </Button>
                {showChart && (
                  <div className="mt-3">
                    <TournamentComparisonChart tournaments={player.tournaments} />
                  </div>
                )}
              </div>
            )}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tournament</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Dates
                    </TableHead>
                    <TableHead className="text-right">Rank</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Rating</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">±</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">
                      Performance
                    </TableHead>
                    <TableHead className="text-right hidden md:table-cell">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {player.tournaments.map((t) => (
                    <TableRow key={t.tournamentId}>
                      <TableCell>
                        <Link
                          href={`/tournaments/${t.tournamentId}`}
                          className="font-medium hover:underline"
                        >
                          {t.tournamentName}
                        </Link>
                        <div className="text-xs text-muted-foreground sm:hidden">
                          {new Date(t.startDate).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                        {new Date(t.startDate).toLocaleDateString()} -{" "}
                        {new Date(t.endDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.currentRank ?? t.startingRank ?? "-"}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell font-mono tabular-nums">
                        {t.startingRating ?? "—"}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell tabular-nums">
                        {t.startingRating != null && t.currentRating != null ? (
                          (() => {
                            const delta = t.currentRating - t.startingRating;
                            if (delta === 0) return <span className="text-muted-foreground">0</span>;
                            return (
                              <span className={delta > 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                                {delta > 0 ? "+" : ""}{delta}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{t.points}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {t.performance ?? "-"}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        <Badge
                          variant={
                            t.status === "completed" ? "secondary" : "default"
                          }
                        >
                          {t.status === "completed" ? "Completed" : "Live"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </TabsContent>

        {/* Openings Tab */}
        <TabsContent value="openings" className="mt-4">
          <OpeningStats playerId={player.id} />
        </TabsContent>

        {/* Rating History Tab */}
        <TabsContent value="ratings" className="mt-4">
          <RatingHistoryTab ratingHistory={player.ratingHistory} tournaments={player.tournaments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
