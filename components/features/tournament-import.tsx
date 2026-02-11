"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";

export function TournamentImport() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleImport() {
    if (!url.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/tournaments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to import tournament");
        return;
      }

      if (data.alreadyExists) {
        toast.info("Tournament was already imported");
      } else {
        toast.success("Tournament imported successfully!");
      }

      router.push(`/tournaments/${data.id}`);
    } catch {
      toast.error("Failed to import tournament. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-xl gap-2">
      <Input
        placeholder="Paste chess-results.com tournament URL..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleImport()}
        disabled={loading}
        className="flex-1"
      />
      <Button onClick={handleImport} disabled={loading || !url.trim()}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        {loading ? "Importing..." : "Import"}
      </Button>
    </div>
  );
}
