"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface FollowedPlayerInfo {
  id: string;
  name: string;
  title: string | null;
  rating: number | null;
  country: string | null;
  recentTournaments: {
    tournamentId: string;
    tournamentName: string;
    startDate: string;
    status: string;
    points: number | null;
    currentRank: number | null;
    performance: number | null;
  }[];
}

interface FollowedPlayersContextValue {
  followedPlayerIds: Set<string>;
  followedPlayers: FollowedPlayerInfo[];
  loading: boolean;
  refresh: () => void;
}

const FollowedPlayersContext = createContext<FollowedPlayersContextValue>({
  followedPlayerIds: new Set(),
  followedPlayers: [],
  loading: false,
  refresh: () => {},
});

export function FollowedPlayersProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [followedPlayers, setFollowedPlayers] = useState<FollowedPlayerInfo[]>([]);
  const [followedPlayerIds, setFollowedPlayerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!session?.user) {
      setFollowedPlayers([]);
      setFollowedPlayerIds(new Set());
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/users/me/following/players");
      if (!res.ok) return;
      const data = await res.json();
      const players: FollowedPlayerInfo[] = data.players.map(
        (fp: { player: FollowedPlayerInfo }) => fp.player
      );
      setFollowedPlayers(players);
      setFollowedPlayerIds(new Set(players.map((p) => p.id)));
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <FollowedPlayersContext.Provider value={{ followedPlayerIds, followedPlayers, loading, refresh }}>
      {children}
    </FollowedPlayersContext.Provider>
  );
}

export function useFollowedPlayers() {
  return useContext(FollowedPlayersContext);
}
