/**
 * Auto-sync scheduler using BullMQ repeatable jobs.
 *
 * Periodically checks for tournaments that need refreshing and enqueues
 * import jobs for them. Tournaments are considered stale when:
 *   - status is not 'completed'
 *   - AND (lastScrapedAt is null OR lastScrapedAt + scrapingFrequencyMins < now)
 */

import { Queue, type ConnectionOptions } from 'bullmq';
import { prisma } from '@/lib/db';
import { createImportJob } from './import-service';
import { enqueueImportJob } from './import-worker';
import type { SourceType } from '@/lib/providers/types';

const SYNC_QUEUE_NAME = 'sync-scheduler';
const SYNC_JOB_NAME = 'check-stale-tournaments';
const DEFAULT_SCRAPING_FREQUENCY_MINS = 15;
const CHECK_INTERVAL_MS = 60_000; // 60 seconds

// ---------------------------------------------------------------------------
// Redis connection (shared logic with import-worker)
// ---------------------------------------------------------------------------

function getRedisConnection(): ConnectionOptions | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    };
  } catch {
    return null;
  }
}

let schedulerQueue: Queue | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Core sync logic
// ---------------------------------------------------------------------------

/**
 * Find tournaments that need refreshing and enqueue import jobs for each.
 */
async function checkAndEnqueueStale(): Promise<void> {
  try {
    const now = new Date();

    // Find all active (non-completed) tournaments
    const tournaments = await prisma.tournament.findMany({
      where: {
        status: { not: 'completed' },
      },
      select: {
        id: true,
        externalId: true,
        sourceType: true,
        sourceUrl: true,
        lastScrapedAt: true,
        scrapingFrequencyMins: true,
      },
    });

    for (const t of tournaments) {
      const freqMins =
        t.scrapingFrequencyMins ?? DEFAULT_SCRAPING_FREQUENCY_MINS;

      // Check if this tournament is stale
      if (t.lastScrapedAt) {
        const staleAfter = new Date(
          t.lastScrapedAt.getTime() + freqMins * 60_000
        );
        if (now < staleAfter) {
          continue; // Still fresh
        }
      }

      // Enqueue a refresh job
      const jobId = await createImportJob({
        sourceType: t.sourceType as SourceType,
        url: t.sourceUrl,
        tournamentId: t.externalId,
      });

      await enqueueImportJob(jobId);

      console.log(
        `[sync-scheduler] Enqueued refresh for tournament ${t.externalId} (job ${jobId})`
      );
    }
  } catch (error) {
    console.error(
      '[sync-scheduler] Error checking stale tournaments:',
      error instanceof Error ? error.message : error
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the sync scheduler.
 *
 * If Redis is available, uses a BullMQ repeatable job.
 * Otherwise, falls back to a simple setInterval.
 */
export async function startSyncScheduler(): Promise<void> {
  const conn = getRedisConnection();

  if (conn) {
    schedulerQueue = new Queue(SYNC_QUEUE_NAME, { connection: conn });

    // Remove any existing repeatable job to avoid duplicates
    const repeatables = await schedulerQueue.getRepeatableJobs();
    for (const job of repeatables) {
      if (job.name === SYNC_JOB_NAME) {
        await schedulerQueue.removeRepeatableByKey(job.key);
      }
    }

    // Add a repeatable job that fires every 60 seconds
    await schedulerQueue.add(
      SYNC_JOB_NAME,
      {},
      {
        repeat: { every: CHECK_INTERVAL_MS },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      }
    );

    // NOTE: The actual worker that processes this queue's jobs must be
    // created separately in the worker process. It should call
    // checkAndEnqueueStale() when it receives the SYNC_JOB_NAME job.
    console.log('[sync-scheduler] Started with BullMQ repeatable job');
  } else {
    // Fallback: simple interval
    if (intervalId) {
      clearInterval(intervalId);
    }
    intervalId = setInterval(checkAndEnqueueStale, CHECK_INTERVAL_MS);
    console.log('[sync-scheduler] Started with setInterval fallback');
  }
}

/**
 * Stop the sync scheduler.
 */
export async function stopSyncScheduler(): Promise<void> {
  if (schedulerQueue) {
    const repeatables = await schedulerQueue.getRepeatableJobs();
    for (const job of repeatables) {
      if (job.name === SYNC_JOB_NAME) {
        await schedulerQueue.removeRepeatableByKey(job.key);
      }
    }
    await schedulerQueue.close();
    schedulerQueue = null;
    console.log('[sync-scheduler] Stopped BullMQ scheduler');
  }

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[sync-scheduler] Stopped interval scheduler');
  }
}

// Export for use by the sync worker process
export { checkAndEnqueueStale };
