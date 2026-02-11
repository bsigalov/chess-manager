/**
 * Import orchestrator.
 *
 * Manages the lifecycle of import jobs:
 *   1. createImportJob -- persist the job record
 *   2. processImportJob -- resolve provider, fetch, upsert, update status
 *   3. getJobStatus -- poll for completion
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ImportInput } from '@/lib/providers/types';
import { providerRegistry } from '@/lib/providers/provider-registry';
import { upsertTournament } from './upsert-tournament';

/**
 * Create an ImportJob record with status='pending'.
 * Returns the job ID.
 */
export async function createImportJob(
  input: ImportInput,
  userId?: string
): Promise<string> {
  const job = await prisma.importJob.create({
    data: {
      sourceType: input.sourceType,
      inputData: input as unknown as Prisma.InputJsonValue,
      status: 'pending',
      userId: userId ?? null,
      startedAt: new Date(),
    },
  });
  return job.id;
}

/**
 * Process an import job end-to-end.
 *
 * 1. Mark as 'processing'
 * 2. Resolve the provider
 * 3. Fetch normalized tournament data
 * 4. Upsert into the database
 * 5. Mark as 'completed' with result stats
 *
 * On any error, marks the job as 'failed' with the error message.
 */
export async function processImportJob(jobId: string): Promise<void> {
  let job;
  try {
    job = await prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new Error(`Import job ${jobId} not found`);
    }

    // Mark as processing
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    const input = job.inputData as unknown as ImportInput;

    // Resolve provider
    const provider = providerRegistry.resolve(input);

    // Fetch tournament data
    const normalized = await provider.fetchTournament(input);

    // Persist to database
    const result = await upsertTournament(normalized);

    // Mark completed
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        resultData: {
          tournamentId: result.tournamentId,
          created: result.created,
          stats: result.stats as unknown as Prisma.InputJsonValue,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(`Import job ${jobId} failed:`, message);

    try {
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: message,
        },
      });
    } catch (updateError) {
      // If we can't even update the job status, log but don't throw
      console.error(
        `Failed to update job ${jobId} status to failed:`,
        updateError
      );
    }
  }
}

/**
 * Get the current status of an import job.
 */
export async function getJobStatus(jobId: string) {
  return prisma.importJob.findUnique({ where: { id: jobId } });
}
