import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

interface Props {
  params: Promise<{ id: string; gameId: string }>;
}

export default async function GameDetailPage({ params }: Props) {
  const { id: tournamentId, gameId: pairingId } = await params;

  const pairing = await prisma.pairing.findUnique({
    where: { id: pairingId },
    include: {
      whitePlayer: true,
      blackPlayer: true,
      game: true,
      tournament: { select: { name: true } },
    },
  });

  if (!pairing || pairing.tournamentId !== tournamentId) {
    notFound();
  }

  const game = pairing.game;

  function resultLabel(result: string | null): string {
    if (!result) return "In progress";
    if (result === "1-0") return "White wins";
    if (result === "0-1") return "Black wins";
    if (result === "1/2-1/2") return "Draw";
    return result;
  }

  return (
    <div className="container px-4 py-8 max-w-3xl">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Tournaments", href: "/tournaments" },
          { label: pairing.tournament.name, href: `/tournaments/${tournamentId}` },
          { label: `Round ${pairing.round} Board ${pairing.board}` },
        ]}
      />

      <h1 className="text-xl font-bold mb-1">
        Round {pairing.round}, Board {pairing.board}
      </h1>

      {/* Players and result */}
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            {/* White */}
            <div className="flex-1 text-center">
              <div className="text-xs text-muted-foreground mb-1">White</div>
              <div className="font-semibold">
                {pairing.whitePlayer ? (
                  <Link
                    href={`/players/${pairing.whitePlayer.id}`}
                    className="hover:underline"
                  >
                    {pairing.whitePlayer.title && (
                      <span className="text-amber-600 dark:text-amber-400 mr-1">
                        {pairing.whitePlayer.title}
                      </span>
                    )}
                    {pairing.whitePlayer.name}
                  </Link>
                ) : (
                  "BYE"
                )}
              </div>
              {pairing.whiteElo && (
                <div className="text-sm text-muted-foreground">
                  {pairing.whiteElo}
                </div>
              )}
            </div>

            {/* Result */}
            <div className="text-center shrink-0">
              <div className="text-2xl font-bold font-mono">
                {pairing.result ?? "*"}
              </div>
              <div className="text-xs text-muted-foreground">
                {resultLabel(pairing.result)}
              </div>
            </div>

            {/* Black */}
            <div className="flex-1 text-center">
              <div className="text-xs text-muted-foreground mb-1">Black</div>
              <div className="font-semibold">
                {pairing.blackPlayer ? (
                  <Link
                    href={`/players/${pairing.blackPlayer.id}`}
                    className="hover:underline"
                  >
                    {pairing.blackPlayer.title && (
                      <span className="text-amber-600 dark:text-amber-400 mr-1">
                        {pairing.blackPlayer.title}
                      </span>
                    )}
                    {pairing.blackPlayer.name}
                  </Link>
                ) : (
                  "BYE"
                )}
              </div>
              {pairing.blackElo && (
                <div className="text-sm text-muted-foreground">
                  {pairing.blackElo}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opening info */}
      {game && (game.ecoCode || game.openingName) && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Opening</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {game.ecoCode && (
                <Badge variant="outline">{game.ecoCode}</Badge>
              )}
              {game.openingName && (
                <span className="text-sm">{game.openingName}</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PGN / Movetext */}
      {(game?.pgnMovetext || pairing.pgn) && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Moves</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm font-mono whitespace-pre-wrap bg-muted p-3 rounded-md">
              {game?.pgnMovetext ?? pairing.pgn}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Additional game info */}
      {game && (game.timeControl || game.termination) && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {game.timeControl && (
                <>
                  <dt className="text-muted-foreground">Time Control</dt>
                  <dd>{game.timeControl}</dd>
                </>
              )}
              {game.termination && (
                <>
                  <dt className="text-muted-foreground">Termination</dt>
                  <dd>{game.termination}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
