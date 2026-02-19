import Link from "next/link";
import { prisma } from "@/lib/db";
import { Users } from "lucide-react";
import { PlayersPageClient } from "@/components/features/players-page-client";

async function getPlayers() {
  try {
    return await prisma.player.findMany({
      orderBy: [{ rating: "desc" }],
      take: 500,
      select: {
        id: true,
        name: true,
        title: true,
        rating: true,
        country: true,
        fideId: true,
        _count: { select: { tournaments: true } },
      },
    });
  } catch {
    return [];
  }
}

export default async function PlayersPage() {
  const players = await getPlayers();

  if (players.length === 0) {
    return (
      <div className="container px-4 py-24 flex flex-col items-center text-center gap-4">
        <Users className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No players found</h2>
        <p className="text-muted-foreground">
          Import a tournament to populate the player database.
        </p>
        <Link href="/" className="text-sm text-primary underline underline-offset-4">
          Go to import
        </Link>
      </div>
    );
  }

  return <PlayersPageClient players={players} />;
}
