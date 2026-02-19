"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ChessResultsPlayer } from "@/lib/scrapers/chess-results-player-search";

type Wizard =
  | { state: "idle" }
  | { state: "searching" }
  | { state: "picking"; players: ChessResultsPlayer[] }
  | { state: "tournaments"; player: ChessResultsPlayer; importedUrls: Set<string> }
  | { state: "importing" }
  | { state: "done" };

export function ChessResultsPlayerSearch() {
  const searchParams = useSearchParams();

  const [lastName, setLastName] = useState(searchParams.get("lastName") ?? "");
  const [firstName, setFirstName] = useState(searchParams.get("firstName") ?? "");
  const [fideId, setFideId] = useState(searchParams.get("fideId") ?? "");

  const [wizard, setWizard] = useState<Wizard>({ state: "idle" });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [players, setPlayers] = useState<ChessResultsPlayer[]>([]);
  const [importedUrls, setImportedUrls] = useState<Set<string>>(new Set());
  const [selectedPlayer, setSelectedPlayer] = useState<ChessResultsPlayer | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  const searching = wizard.state === "searching";
  const importing = wizard.state === "importing";

  const runSearch = useCallback(async (ln: string, fn: string, fid: string) => {
    setWizard({ state: "searching" });
    setSelectedIndex(null);
    try {
      const res = await fetch("/api/players/chess-results-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastName: ln || undefined, firstName: fn || undefined, fideId: fid || undefined }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Search failed");
        setWizard({ state: "idle" });
        return;
      }

      const results: ChessResultsPlayer[] = data.players ?? [];
      setPlayers(results);

      if (results.length === 0) {
        toast.info("No players found. Try a different name.");
        setWizard({ state: "idle" });
      } else {
        setWizard({ state: "picking", players: results });
      }
    } catch {
      toast.error("Search failed. Please try again.");
      setWizard({ state: "idle" });
    }
  }, []);

  // Auto-trigger on mount if URL params present
  useEffect(() => {
    const ln = searchParams.get("lastName") ?? "";
    const fn = searchParams.get("firstName") ?? "";
    const fid = searchParams.get("fideId") ?? "";
    if (ln || fn || fid) {
      runSearch(ln, fn, fid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch() {
    if (!lastName && !firstName && !fideId) return;
    await runSearch(lastName, firstName, fideId);
  }

  async function handleConfirmPlayer() {
    if (selectedIndex === null) return;
    const player = players[selectedIndex];

    // Fetch already-imported URLs from the server by passing all tournament URLs
    const tournamentUrls = player.tournaments.map((t) => t.url);

    // Determine which are already imported by checking the DB via a quick head request.
    // We skip a dedicated /check endpoint — we just pass all URLs to bulk-import later.
    // To show "Already imported" badges we do a lightweight check here.
    let alreadyImported: Set<string> = new Set();
    try {
      const res = await fetch("/api/players/bulk-import/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentUrls }),
      });
      if (res.ok) {
        const data = await res.json();
        alreadyImported = new Set(data.existingUrls ?? []);
      }
    } catch {
      // /check doesn't exist or failed — no badge info, that's fine
    }

    // Pre-select only new (not yet imported) tournaments
    const newUrls = new Set(player.tournaments.map((t) => t.url).filter((u) => !alreadyImported.has(u)));
    setSelectedPlayer(player);
    setImportedUrls(alreadyImported);
    setSelectedUrls(newUrls);
    setWizard({ state: "tournaments", player, importedUrls: alreadyImported });
  }

  async function handleImport() {
    if (!selectedPlayer) return;
    setWizard({ state: "importing" });

    const tournamentUrls = Array.from(selectedUrls);

    try {
      const res = await fetch("/api/players/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentUrls }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Import failed");
        setWizard({ state: "tournaments", player: selectedPlayer, importedUrls });
        return;
      }

      const queued: number = data.queued ?? 0;
      const skipped: number = data.skipped ?? 0;
      toast.success(
        `Queued ${queued} tournament${queued !== 1 ? "s" : ""} for import. Check notifications for progress.` +
          (skipped > 0 ? ` (${skipped} already imported, skipped)` : "")
      );
      setWizard({ state: "done" });
    } catch {
      toast.error("Import failed. Please try again.");
      setWizard({ state: "tournaments", player: selectedPlayer, importedUrls });
    }
  }

  function handleSearchAgain() {
    setWizard({ state: "idle" });
    setSelectedIndex(null);
    setPlayers([]);
    setSelectedPlayer(null);
    setImportedUrls(new Set());
    setSelectedUrls(new Set());
  }

  // ---- DONE state ----
  if (wizard.state === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="text-lg font-semibold">Import queued!</p>
        <p className="text-muted-foreground">
          You can navigate away. Check the notification bell for progress.
        </p>
        <button
          onClick={handleSearchAgain}
          className="text-sm text-primary underline underline-offset-4"
        >
          Search again
        </button>
      </div>
    );
  }

  // ---- TOURNAMENTS state ----
  if (wizard.state === "tournaments" || wizard.state === "importing") {
    const player = selectedPlayer!;
    const sorted = [...player.tournaments].sort((a, b) => {
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;
      return b.endDate.localeCompare(a.endDate);
    });
    const newCount = player.tournaments.filter((t) => !importedUrls.has(t.url)).length;
    const importedCount = player.tournaments.length - newCount;
    const selectableUrls = sorted.filter((t) => !importedUrls.has(t.url)).map((t) => t.url);
    const allSelected = selectableUrls.length > 0 && selectableUrls.every((u) => selectedUrls.has(u));
    const someSelected = selectableUrls.some((u) => selectedUrls.has(u));

    function toggleAll() {
      if (allSelected) {
        setSelectedUrls(new Set());
      } else {
        setSelectedUrls(new Set(selectableUrls));
      }
    }

    function toggleOne(url: string) {
      setSelectedUrls((prev) => {
        const next = new Set(prev);
        if (next.has(url)) next.delete(url);
        else next.add(url);
        return next;
      });
    }

    function formatDate(raw: string | null | undefined) {
      if (!raw) return "—";
      // raw is like "2025/11/27" or "2025-11-27"
      const d = new Date(raw.replace(/\//g, "-"));
      if (isNaN(d.getTime())) return raw;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWizard({ state: "picking", players })}
            disabled={importing}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-sm font-medium">{player.name}</span>
        </div>

        <p className="text-sm text-muted-foreground">
          {newCount} new, {importedCount} already imported
        </p>

        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                    onChange={toggleAll}
                    disabled={importing || selectableUrls.length === 0}
                    className="accent-primary"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-2 text-left font-medium">Tournament</th>
                <th className="px-4 py-2 text-left font-medium">End date</th>
                <th className="px-4 py-2 text-left font-medium">Rounds</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const already = importedUrls.has(t.url);
                const checked = selectedUrls.has(t.url);
                return (
                  <tr
                    key={t.url}
                    className={`border-b hover:bg-muted/30 ${!already && !importing ? "cursor-pointer" : ""}`}
                    onClick={() => !already && !importing && toggleOne(t.url)}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={already || importing}
                        onChange={() => toggleOne(t.url)}
                        onClick={(e) => e.stopPropagation()}
                        className="accent-primary"
                      />
                    </td>
                    <td className="px-4 py-2 font-medium">{t.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(t.endDate)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{t.rounds ?? "—"}</td>
                    <td className="px-4 py-2">
                      {already ? (
                        <Badge variant="secondary">Already imported</Badge>
                      ) : (
                        <Badge>New</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Button
          onClick={handleImport}
          disabled={importing || selectedUrls.size === 0}
          className="self-start"
        >
          {importing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            `Import ${selectedUrls.size} tournament${selectedUrls.size !== 1 ? "s" : ""}`
          )}
        </Button>
      </div>
    );
  }

  // ---- PICKING state ----
  if (wizard.state === "picking") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setWizard({ state: "idle" })}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-sm text-muted-foreground">
            {wizard.players.length} player{wizard.players.length !== 1 ? "s" : ""} found
          </span>
        </div>

        <div className="rounded-md border overflow-hidden">
          {wizard.players.map((p, i) => (
            <label
              key={`${p.name}|${p.fideId ?? ""}|${p.country ?? ""}`}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 border-b last:border-b-0 ${
                selectedIndex === i ? "bg-muted/60" : ""
              }`}
            >
              <input
                type="radio"
                name="player"
                value={i}
                checked={selectedIndex === i}
                onChange={() => setSelectedIndex(i)}
                className="accent-primary"
              />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{p.name}</span>
                {p.country && (
                  <span className="ml-2 text-xs text-muted-foreground">{p.country}</span>
                )}
                {p.fideId && (
                  <span className="ml-2 text-xs text-muted-foreground">FIDE {p.fideId}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {p.tournaments.length} tournament{p.tournaments.length !== 1 ? "s" : ""}
              </span>
            </label>
          ))}
        </div>

        <Button
          onClick={handleConfirmPlayer}
          disabled={selectedIndex === null}
          className="self-start"
        >
          Confirm
        </Button>
      </div>
    );
  }

  // ---- SEARCH FORM (idle / searching) ----
  return (
    <div className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Last name</label>
          <Input
            placeholder="e.g. Carlsen"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            disabled={searching}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">First name</label>
          <Input
            placeholder="e.g. Magnus"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            disabled={searching}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">FIDE ID</label>
          <Input
            placeholder="e.g. 1503014"
            value={fideId}
            onChange={(e) => setFideId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            disabled={searching}
          />
        </div>
      </div>

      <Button
        onClick={handleSearch}
        disabled={searching || (!lastName && !firstName && !fideId)}
        className="self-start"
      >
        {searching ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Search className="h-4 w-4 mr-2" />
            Search chess-results.com
          </>
        )}
      </Button>
    </div>
  );
}
