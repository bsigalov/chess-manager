"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StandingsTable } from "@/components/features/standings-table";
import { PairingsView } from "@/components/features/pairings-view";
import { MapPin, Users, RefreshCw, Loader2 } from "lucide-react";

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
    rank: number;
    name: string;
    title: string | null;
    rating: number | null;
    federation: string | null;
    points: number;
    performance: number | null;
  }[];
  pairings: Record<
    number,
    {
      board: number;
      whiteName: string;
      blackName: string;
      whiteRating: number | null;
      blackRating: number | null;
      result: string | null;
    }[]
  >;
}

export function TournamentDetail({
  tournament,
}: {
  tournament: TournamentData;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

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

  return (
    <div className="container px-4 py-8">
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

      {/* Tabs */}
      <Tabs defaultValue="standings">
        <TabsList>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="pairings">Pairings</TabsTrigger>
        </TabsList>
        <TabsContent value="standings" className="mt-4">
          <StandingsTable standings={tournament.standings} />
        </TabsContent>
        <TabsContent value="pairings" className="mt-4">
          <PairingsView
            pairings={tournament.pairings}
            totalRounds={tournament.rounds}
            currentRound={tournament.currentRound}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
