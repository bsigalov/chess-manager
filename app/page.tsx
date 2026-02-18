import { TournamentImport } from "@/components/features/tournament-import";
import { TournamentCard } from "@/components/features/tournament-card";
import { MyPlayersSection } from "@/components/features/my-players-section";
import { prisma } from "@/lib/db";

async function getRecentTournaments() {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
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

export default async function Home() {
  const tournaments = await getRecentTournaments();

  return (
    <div className="container px-4 py-12">
      {/* Hero */}
      <div className="flex flex-col items-center text-center gap-6 mb-16">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Chess Tournament Manager
        </h1>
        <p className="text-muted-foreground max-w-md">
          Import and track chess tournaments from chess-results.com with a
          modern, responsive interface.
        </p>
        <TournamentImport />
      </div>

      <MyPlayersSection />

      {/* Recent tournaments */}
      {tournaments.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent Tournaments</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} {...t} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
