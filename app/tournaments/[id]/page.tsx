import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TournamentDetail } from "./tournament-detail";

async function getTournament(id: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      players: {
        include: { player: true },
      },
      pairings: {
        include: { whitePlayer: true, blackPlayer: true },
        orderBy: [{ round: "asc" }, { board: "asc" }],
      },
    },
  });

  if (!tournament) return null;

  const standings = tournament.players
    .map((tp) => ({
      playerId: tp.player.id,
      rank: tp.currentRank ?? tp.startingRank ?? 0,
      name: tp.player.name,
      title: tp.player.title,
      rating: tp.startingRating ?? tp.player.rating,
      federation: tp.player.country,
      points: tp.points,
      performance: tp.performance,
    }))
    .sort((a, b) => b.points - a.points || a.rank - b.rank);

  const pairings: Record<
    number,
    {
      board: number;
      whitePlayerId: string | null;
      whiteName: string;
      blackPlayerId: string | null;
      blackName: string;
      whiteRating: number | null;
      blackRating: number | null;
      result: string | null;
    }[]
  > = {};
  for (const p of tournament.pairings) {
    if (!pairings[p.round]) pairings[p.round] = [];
    pairings[p.round].push({
      board: p.board,
      whitePlayerId: p.whitePlayer?.id ?? null,
      whiteName: p.whitePlayer?.name ?? "BYE",
      blackPlayerId: p.blackPlayer?.id ?? null,
      blackName: p.blackPlayer?.name ?? "BYE",
      whiteRating: p.whiteElo ?? p.whitePlayer?.rating ?? null,
      blackRating: p.blackElo ?? p.blackPlayer?.rating ?? null,
      result: p.result,
    });
  }

  return {
    id: tournament.id,
    name: tournament.name,
    venue: tournament.venue,
    city: tournament.city,
    country: tournament.country,
    startDate: tournament.startDate.toISOString(),
    endDate: tournament.endDate.toISOString(),
    rounds: tournament.rounds,
    currentRound: tournament.currentRound,
    status: tournament.status,
    playerCount: tournament.players.length,
    standings,
    pairings,
  };
}

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) notFound();

  return <TournamentDetail tournament={tournament} />;
}
