import { NextRequest } from 'next/server';
import { subscribeToTournament } from '@/lib/events/event-bus';
import { TournamentEvent } from '@/lib/events/event-types';

const KEEPALIVE_INTERVAL_MS = 30_000;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tournamentsParam = request.nextUrl.searchParams.get('tournaments');

  if (!tournamentsParam) {
    return new Response(
      JSON.stringify({ error: 'Missing tournaments query parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const tournamentIds = tournamentsParam
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (tournamentIds.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No valid tournament IDs provided' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribers: Array<() => void> = [];

      const sendEvent = (event: TournamentEvent) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Stream closed, will be cleaned up
        }
      };

      // Subscribe to each requested tournament
      for (const id of tournamentIds) {
        const unsub = subscribeToTournament(id, sendEvent);
        unsubscribers.push(unsub);
      }

      // Keepalive ping to prevent proxy/LB timeouts
      const keepalive = setInterval(() => {
        try {
          const ping = `:keepalive ${Date.now()}\n\n`;
          controller.enqueue(encoder.encode(ping));
        } catch {
          clearInterval(keepalive);
        }
      }, KEEPALIVE_INTERVAL_MS);

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(keepalive);
        for (const unsub of unsubscribers) {
          unsub();
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
