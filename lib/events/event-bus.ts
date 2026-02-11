import Redis from 'ioredis';
import { TournamentEvent } from './event-types';

const CHANNEL_PREFIX = 'chess-manager:events:';

function getRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

function createRedisClient(label: string): Redis | null {
  try {
    const client = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    client.on('error', (err) => {
      console.warn(`[EventBus] Redis ${label} error:`, err.message);
    });

    return client;
  } catch (err) {
    console.warn(`[EventBus] Failed to create Redis ${label} client:`, err);
    return null;
  }
}

// Lazy singleton for the publisher connection
let pubClient: Redis | null | undefined;

function getPubClient(): Redis | null {
  if (pubClient === undefined) {
    pubClient = createRedisClient('publisher');
    pubClient?.connect().catch(() => {
      pubClient = null;
    });
  }
  return pubClient;
}

/**
 * Publish a tournament event to Redis Pub/Sub.
 * Silently degrades if Redis is unavailable.
 */
export async function publishEvent(event: TournamentEvent): Promise<void> {
  const client = getPubClient();
  if (!client) return;

  const channel = `${CHANNEL_PREFIX}${event.tournamentId}`;
  const payload = JSON.stringify(event);

  try {
    await client.publish(channel, payload);
  } catch (err) {
    console.warn('[EventBus] Failed to publish event:', err);
  }
}

/**
 * Subscribe to events for a specific tournament.
 * Returns an unsubscribe function for cleanup.
 */
export function subscribeToTournament(
  tournamentId: string,
  callback: (event: TournamentEvent) => void
): () => void {
  const subClient = createRedisClient('subscriber');
  if (!subClient) {
    return () => {};
  }

  const channel = `${CHANNEL_PREFIX}${tournamentId}`;
  let closed = false;

  subClient.connect().then(() => {
    if (closed) {
      subClient.disconnect();
      return;
    }

    subClient.subscribe(channel).catch((err) => {
      console.warn(`[EventBus] Failed to subscribe to ${channel}:`, err);
    });

    subClient.on('message', (_ch: string, message: string) => {
      try {
        const event = JSON.parse(message) as TournamentEvent;
        callback(event);
      } catch (err) {
        console.warn('[EventBus] Failed to parse event:', err);
      }
    });
  }).catch((err) => {
    console.warn('[EventBus] Subscriber connection failed:', err);
  });

  return () => {
    closed = true;
    subClient.unsubscribe(channel).catch(() => {});
    subClient.disconnect();
  };
}

/**
 * Subscribe to all tournament events using pattern matching.
 * Returns an unsubscribe function for cleanup.
 */
export function subscribeToAll(
  callback: (event: TournamentEvent) => void
): () => void {
  const subClient = createRedisClient('pattern-subscriber');
  if (!subClient) {
    return () => {};
  }

  const pattern = `${CHANNEL_PREFIX}*`;
  let closed = false;

  subClient.connect().then(() => {
    if (closed) {
      subClient.disconnect();
      return;
    }

    subClient.psubscribe(pattern).catch((err) => {
      console.warn(`[EventBus] Failed to pattern-subscribe to ${pattern}:`, err);
    });

    subClient.on('pmessage', (_pattern: string, _channel: string, message: string) => {
      try {
        const event = JSON.parse(message) as TournamentEvent;
        callback(event);
      } catch (err) {
        console.warn('[EventBus] Failed to parse event:', err);
      }
    });
  }).catch((err) => {
    console.warn('[EventBus] Pattern subscriber connection failed:', err);
  });

  return () => {
    closed = true;
    subClient.punsubscribe(pattern).catch(() => {});
    subClient.disconnect();
  };
}
