"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { toast } from "sonner";
import { OpeningStats } from "@/components/features/opening-stats";
import { TournamentComparisonChart } from "@/components/features/tournament-comparison-chart";

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
  const [claiming, setClaiming] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const titleDisplay = player.title ? `${player.title} ` : "";

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
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FollowButton playerId={player.id} initialFollowed={isFollowing} />
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
      <Tabs defaultValue="overview">
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
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg Performance</CardDescription>
                <CardTitle className="text-3xl">
                  {avgPerformance ?? "N/A"}
                </CardTitle>
              </CardHeader>
            </Card>
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
          {player.ratingHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No rating history available.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Rating summary cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                {(["standard", "rapid", "blitz"] as const).map((type) => {
                  const entries = player.ratingHistory.filter(
                    (r) => r.ratingType === type
                  );
                  if (entries.length === 0) return null;

                  const latest = entries[0];
                  const oldest = entries[entries.length - 1];
                  const change = latest.rating - oldest.rating;

                  return (
                    <Card key={type}>
                      <CardHeader className="pb-2">
                        <CardDescription className="capitalize">
                          {type}
                        </CardDescription>
                        <CardTitle className="text-2xl">
                          {latest.rating}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p
                          className={`text-sm ${
                            change > 0
                              ? "text-green-600 dark:text-green-400"
                              : change < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {change > 0 ? "+" : ""}
                          {change} since{" "}
                          {new Date(oldest.recordedAt).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Rating history table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Source
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {player.ratingHistory.map((rh) => (
                      <TableRow key={rh.id}>
                        <TableCell>
                          {new Date(rh.recordedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {rh.ratingType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {rh.rating}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {rh.source}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
