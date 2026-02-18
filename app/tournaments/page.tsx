import { prisma } from "@/lib/db";
import { TournamentCard } from "@/components/features/tournament-card";
import { TournamentSearch } from "@/components/features/tournament-search";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { Prisma } from "@prisma/client";

interface Props {
  searchParams: Promise<{ q?: string; status?: string; country?: string }>;
}

async function getTournaments(filters: {
  q?: string;
  status?: string;
  country?: string;
}) {
  try {
    const where: Prisma.TournamentWhereInput = {};
    if (filters.q) {
      where.name = { contains: filters.q, mode: "insensitive" };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.country) {
      where.country = filters.country;
    }

    const tournaments = await prisma.tournament.findMany({
      where,
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

async function getCountries(): Promise<string[]> {
  try {
    const results = await prisma.tournament.findMany({
      select: { country: true },
      distinct: ["country"],
      where: { country: { not: null } },
      orderBy: { country: "asc" },
    });
    return results.map((r) => r.country!).filter(Boolean);
  } catch {
    return [];
  }
}

export default async function TournamentsPage({ searchParams }: Props) {
  const filters = await searchParams;
  const [tournaments, countries] = await Promise.all([
    getTournaments(filters),
    getCountries(),
  ]);

  return (
    <div className="container px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Tournaments</h1>

      <TournamentSearch countries={countries} />

      {tournaments.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-4 py-16">
          <Trophy className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No tournaments found</h2>
          <p className="text-muted-foreground">
            {filters.q || filters.status || filters.country
              ? "Try adjusting your search filters."
              : "Import a tournament from chess-results.com to get started."}
          </p>
          {!filters.q && !filters.status && !filters.country && (
            <Link
              href="/"
              className="text-sm text-primary underline underline-offset-4"
            >
              Go to import
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <TournamentCard key={t.id} {...t} />
          ))}
        </div>
      )}
    </div>
  );
}
