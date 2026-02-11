import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * Start a new sync log entry. Returns the log ID for later completion.
 */
export async function startSyncLog(
  tournamentId: string,
  syncType: string
): Promise<string> {
  const log = await prisma.dataSyncLog.create({
    data: {
      tournamentId,
      syncType,
      status: 'running',
      startedAt: new Date(),
    },
  });

  return log.id;
}

/**
 * Mark a sync log as successfully completed with a changes summary.
 */
export async function completeSyncLog(
  logId: string,
  changes: Record<string, unknown>
): Promise<void> {
  const log = await prisma.dataSyncLog.findUnique({
    where: { id: logId },
    select: { startedAt: true },
  });

  const now = new Date();
  const durationMs = log ? now.getTime() - log.startedAt.getTime() : null;

  await prisma.dataSyncLog.update({
    where: { id: logId },
    data: {
      status: 'completed',
      changesSummary: changes as Prisma.InputJsonValue,
      durationMs,
      completedAt: now,
    },
  });
}

/**
 * Mark a sync log as failed with an error message.
 */
export async function failSyncLog(
  logId: string,
  error: string
): Promise<void> {
  const log = await prisma.dataSyncLog.findUnique({
    where: { id: logId },
    select: { startedAt: true },
  });

  const now = new Date();
  const durationMs = log ? now.getTime() - log.startedAt.getTime() : null;

  await prisma.dataSyncLog.update({
    where: { id: logId },
    data: {
      status: 'failed',
      changesSummary: { error } as Prisma.InputJsonValue,
      durationMs,
      completedAt: now,
    },
  });
}

/**
 * Get recent sync logs for a tournament, ordered by most recent first.
 */
export async function getRecentSyncLogs(
  tournamentId: string,
  limit = 20
) {
  return prisma.dataSyncLog.findMany({
    where: { tournamentId },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}
