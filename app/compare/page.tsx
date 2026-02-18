"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";

interface PlayerInfo {
  id: string;
  name: string;
  title: string | null;
  rating: number | null;
}

interface H2HGame {
  pairingId: string;
  tournamentId: string;
  tournamentName: string;
  round: number;
  board: number;
  p1Color: string;
  result: string | null;
  whiteElo: number | null;
  blackElo: number | null;
}

interface CompareResult {
  player1: PlayerInfo;
  player2: PlayerInfo;
  summary: { p1Wins: number; p2Wins: number; draws: number; total: number };
  games: H2HGame[];
}

export default function ComparePage() {
  const searchParams = useSearchParams();
  const [p1Search, setP1Search] = useState("");
  const [p2Search, setP2Search] = useState("");
  const [p1Results, setP1Results] = useState<PlayerInfo[]>([]);
  const [p2Results, setP2Results] = useState<PlayerInfo[]>([]);
  const [player1Id, setPlayer1Id] = useState(searchParams.get("player1") ?? "");
  const [player2Id, setPlayer2Id] = useState(searchParams.get("player2") ?? "");
  const [data, setData] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchingP1, setSearchingP1] = useState(false);
  const [searchingP2, setSearchingP2] = useState(false);

  async function searchPlayers(query: string, setSide: (r: PlayerInfo[]) => void, setSearching: (b: boolean) => void) {
    if (query.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/players?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const players = await res.json();
        setSide(players.slice(0, 10));
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  }

  async function compare() {
    if (!player1Id || !player2Id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/players/compare?player1=${player1Id}&player2=${player2Id}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Auto-compare if both IDs are present from URL
  useState(() => {
    if (player1Id && player2Id) {
      compare();
    }
  });

  return (
    <div className="container px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Head-to-Head Comparison</h1>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* Player 1 search */}
        <div>
          <label className="text-sm font-medium mb-1 block">Player 1</label>
          <div className="flex gap-2">
            <Input
              placeholder="Search player..."
              value={p1Search}
              onChange={(e) => setP1Search(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchPlayers(p1Search, setP1Results, setSearchingP1);
              }}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => searchPlayers(p1Search, setP1Results, setSearchingP1)}
              disabled={searchingP1}
            >
              {searchingP1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {p1Results.length > 0 && (
            <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
              {p1Results.map((p) => (
                <button
                  key={p.id}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted ${
                    player1Id === p.id ? "bg-muted font-medium" : ""
                  }`}
                  onClick={() => {
                    setPlayer1Id(p.id);
                    setP1Search(`${p.title ? p.title + " " : ""}${p.name}`);
                    setP1Results([]);
                  }}
                >
                  {p.title && <span className="text-amber-600 mr-1">{p.title}</span>}
                  {p.name}
                  {p.rating && <span className="text-muted-foreground ml-1">({p.rating})</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Player 2 search */}
        <div>
          <label className="text-sm font-medium mb-1 block">Player 2</label>
          <div className="flex gap-2">
            <Input
              placeholder="Search player..."
              value={p2Search}
              onChange={(e) => setP2Search(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchPlayers(p2Search, setP2Results, setSearchingP2);
              }}
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => searchPlayers(p2Search, setP2Results, setSearchingP2)}
              disabled={searchingP2}
            >
              {searchingP2 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {p2Results.length > 0 && (
            <div className="border rounded-md mt-1 max-h-40 overflow-y-auto">
              {p2Results.map((p) => (
                <button
                  key={p.id}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted ${
                    player2Id === p.id ? "bg-muted font-medium" : ""
                  }`}
                  onClick={() => {
                    setPlayer2Id(p.id);
                    setP2Search(`${p.title ? p.title + " " : ""}${p.name}`);
                    setP2Results([]);
                  }}
                >
                  {p.title && <span className="text-amber-600 mr-1">{p.title}</span>}
                  {p.name}
                  {p.rating && <span className="text-muted-foreground ml-1">({p.rating})</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Button
        onClick={compare}
        disabled={!player1Id || !player2Id || loading}
        className="mb-6"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Compare
      </Button>

      {/* Results */}
      {data && (
        <>
          {/* Summary bar */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {data.player1.title && `${data.player1.title} `}
                {data.player1.name} vs{" "}
                {data.player2.title && `${data.player2.title} `}
                {data.player2.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.summary.total === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No games found between these players.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-lg font-bold">
                      {data.summary.p1Wins} - {data.summary.draws} -{" "}
                      {data.summary.p2Wins}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({data.summary.total} games)
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden flex">
                    {data.summary.total > 0 && (
                      <>
                        <div
                          className="bg-emerald-500 h-full"
                          style={{
                            width: `${(data.summary.p1Wins / data.summary.total) * 100}%`,
                          }}
                        />
                        <div
                          className="bg-amber-400 h-full"
                          style={{
                            width: `${(data.summary.draws / data.summary.total) * 100}%`,
                          }}
                        />
                        <div
                          className="bg-red-500 h-full"
                          style={{
                            width: `${(data.summary.p2Wins / data.summary.total) * 100}%`,
                          }}
                        />
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Game list */}
          {data.games.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tournament</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.games.map((g) => (
                    <TableRow key={g.pairingId}>
                      <TableCell>
                        <Link
                          href={`/tournaments/${g.tournamentId}/games/${g.pairingId}`}
                          className="hover:underline text-sm"
                        >
                          {g.tournamentName}
                        </Link>
                      </TableCell>
                      <TableCell>{g.round}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-block w-3 h-3 rounded-full border ${
                            g.p1Color === "white"
                              ? "bg-white"
                              : "bg-gray-800"
                          }`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {g.result ?? "*"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
