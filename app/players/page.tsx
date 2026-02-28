import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { Users } from "lucide-react";
import Link from "next/link";
import { PlayersPageClient } from "@/components/features/players-page-client";

export default async function PlayersPage() {
  const totalCount = await prisma.player.count().catch(() => 0);

  if (totalCount === 0) {
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

  return (
    <Suspense>
      <PlayersPageClient totalCount={totalCount} />
    </Suspense>
  );
}
