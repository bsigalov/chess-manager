/**
 * BullMQ worker for async import processing.
 *
 * Provides a queue-based processing layer with graceful degradation:
 * if Redis is unavailable, jobs are processed synchronously inline.
 */

import { Worker, Queue, type ConnectionOptions } from 'bullmq';
import { processImportJob } from './import-service';

export const IMPORT_QUEUE_NAME = 'import-jobs';

// ---------------------------------------------------------------------------
// Redis connection
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
    console.warn(`[import-worker] Invalid REDIS_URL: "${url}", falling back to sync mode`);
    return null;
  }
}

let redisAvailable: boolean | null = null;
let connectionOpts: ConnectionOptions | null = null;

function getConnection(): ConnectionOptions | null {
  if (redisAvailable === null) {
    connectionOpts = getRedisConnection();
    redisAvailable = connectionOpts !== null;
  }
  return connectionOpts;
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

let queueInstance: Queue | null = null;

/**
 * Get (or lazily create) the BullMQ import queue.
 * Returns null if Redis is not configured.
 */
export function getImportQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;

  if (!queueInstance) {
    queueInstance = new Queue(IMPORT_QUEUE_NAME, {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5_000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return queueInstance;
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

/**
 * Add a job to the import queue.
 *
 * If Redis is unavailable, falls back to processing the job synchronously.
 */
export async function enqueueImportJob(jobId: string): Promise<void> {
  const queue = getImportQueue();

  if (queue) {
    try {
      await queue.add('process-import', { jobId }, { jobId });
      return;
    } catch (error) {
      console.warn(
        `[import-worker] Failed to enqueue job ${jobId}, falling back to sync:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  // Synchronous fallback
  await processImportJob(jobId);
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

/**
 * Create a BullMQ worker that processes import jobs.
 *
 * Call this from a long-running worker process (not from Next.js API routes).
 * Returns null if Redis is not available.
 */
export function createImportWorker(): Worker | null {
  const conn = getConnection();
  if (!conn) {
    console.warn(
      '[import-worker] Redis not available, worker not started. Jobs will be processed synchronously.'
    );
    return null;
  }

  const worker = new Worker(
    IMPORT_QUEUE_NAME,
    async (job) => {
      const { jobId } = job.data as { jobId: string };
      console.log(`[import-worker] Processing job ${jobId}`);
      await processImportJob(jobId);
      console.log(`[import-worker] Completed job ${jobId}`);
    },
    {
      connection: conn,
      concurrency: 2,
      limiter: {
        max: 5,
        duration: 60_000, // Max 5 jobs per minute to respect rate limits
      },
    }
  );

  worker.on('failed', (job, error) => {
    console.error(
      `[import-worker] Job ${job?.id ?? 'unknown'} failed:`,
      error.message
    );
  });

  worker.on('error', (error) => {
    console.error('[import-worker] Worker error:', error.message);
  });

  console.log('[import-worker] Worker started');
  return worker;
}
