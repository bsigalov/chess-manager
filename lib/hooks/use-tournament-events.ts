"use client";

import { useEffect, useCallback, useRef, useState } from 'react';
import { TournamentEvent } from '@/lib/events/event-types';

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

/**
 * React hook for subscribing to real-time tournament events via SSE.
 * Handles auto-reconnection with exponential backoff.
 */
export function useTournamentEvents(
  tournamentIds: string[],
  onEvent: (event: TournamentEvent) => void
) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef = useRef(onEvent);
  const mountedRef = useRef(true);

  // Keep callback ref current without re-triggering effect
  onEventRef.current = onEvent;

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || tournamentIds.length === 0) return;

    cleanup();
    setConnectionState('connecting');

    const params = new URLSearchParams({
      tournaments: tournamentIds.join(','),
    });
    const url = `/api/events?${params.toString()}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setConnectionState('connected');
      backoffRef.current = INITIAL_BACKOFF_MS;
    };

    es.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const parsed = JSON.parse(event.data) as TournamentEvent;
        onEventRef.current(parsed);
      } catch {
        // Ignore malformed messages (e.g., keepalive comments)
      }
    };

    es.onerror = () => {
      if (!mountedRef.current) return;

      es.close();
      eventSourceRef.current = null;
      setConnectionState('disconnected');

      // Exponential backoff reconnect
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * 2, MAX_BACKOFF_MS);

      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, delay);
    };
  }, [tournamentIds, cleanup]);

  useEffect(() => {
    mountedRef.current = true;

    if (tournamentIds.length > 0) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      cleanup();
      setConnectionState('disconnected');
    };
  }, [connect, cleanup, tournamentIds]);

  return { connectionState };
}
