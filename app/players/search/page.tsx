import { Suspense } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ChessResultsPlayerSearch } from "@/components/features/chess-results-player-search";

export const metadata = { title: "Find Player — chess-results.com" };

export default function PlayerSearchPage() {
  return (
    <div className="container px-4 py-8 max-w-3xl">
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "Players", href: "/players" },
        { label: "Find on chess-results.com" },
      ]} />
      <h1 className="text-xl font-bold mb-1 mt-4">Find Player on chess-results.com</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Search by name or FIDE ID to discover all tournaments and import game data.
      </p>
      <Suspense>
        <ChessResultsPlayerSearch />
      </Suspense>
    </div>
  );
}
