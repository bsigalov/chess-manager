import { prisma } from "@/lib/db";
import { TournamentCard } from "@/components/features/tournament-card";
import { Trophy } from "lucide-react";
import Link from "next/link";

async function getTournaments() {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { players: true } } },
    });
    return tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      city: t.city,
      country: t.country,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate.toISOString(),
      rounds: t.rounds,
      currentRound: t.currentRound,
      status: t.status,
      playerCount: t._count.players,
    }));
  } catch {
    return [];
  }
}

export default async function TournamentsPage() {
  const tournaments = await getTournaments();

  if (tournaments.length === 0) {
    return (
      <div className="container px-4 py-24 flex flex-col items-center text-center gap-4">
        <Trophy className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No tournaments found</h2>
        <p className="text-muted-foreground">
          Import a tournament from chess-results.com to get started.
        </p>
        <Link
          href="/"
          className="text-sm text-primary underline underline-offset-4"
        >
          Go to import
        </Link>
      </div>
    );
  }

  return (
    <div className="container px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Tournaments</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((t) => (
          <TournamentCard key={t.id} {...t} />
        ))}
      </div>
    </div>
  );
}
