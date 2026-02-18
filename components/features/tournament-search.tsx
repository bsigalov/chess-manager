"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface TournamentSearchProps {
  countries: string[];
}

export function TournamentSearch({ countries }: TournamentSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "all");
  const [country, setCountry] = useState(
    searchParams.get("country") ?? "all"
  );

  const buildUrl = useCallback(
    (q: string, s: string, c: string) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (s && s !== "all") params.set("status", s);
      if (c && c !== "all") params.set("country", c);
      const qs = params.toString();
      return `/tournaments${qs ? `?${qs}` : ""}`;
    },
    []
  );

  // Debounced text search
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(buildUrl(query, status, country));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, status, country, router, buildUrl]);

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tournaments..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="live">Live</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="upcoming">Upcoming</SelectItem>
        </SelectContent>
      </Select>
      {countries.length > 0 && (
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
