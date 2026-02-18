import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

async function getPlayers() {
  try {
    const players = await prisma.player.findMany({
      orderBy: [{ rating: "desc" }],
      take: 200,
      include: {
        _count: { select: { tournaments: true } },
      },
    });
    return players;
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Players</h1>
        <span className="text-sm text-muted-foreground">
          {players.length} players
        </span>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Player</th>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Rating</th>
              <th className="px-4 py-3 text-left font-medium">Fed</th>
              <th className="px-4 py-3 text-left font-medium">Tournaments</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="border-b hover:bg-muted/30">
                <td className="px-4 py-2">
                  <Link
                    href={`/players/${player.id}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {player.name}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {player.title && (
                    <Badge variant="outline" className="text-xs">
                      {player.title}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2">{player.rating ?? "—"}</td>
                <td className="px-4 py-2">{player.country ?? ""}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {player._count.tournaments}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
