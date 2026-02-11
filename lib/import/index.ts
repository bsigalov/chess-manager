/**
 * Import pipeline public API.
 *
 * Re-exports the key functions consumers need.
 */

export { createImportJob, processImportJob, getJobStatus } from './import-service';
export {
  IMPORT_QUEUE_NAME,
  getImportQueue,
  enqueueImportJob,
  createImportWorker,
} from './import-worker';
export { upsertTournament } from './upsert-tournament';
export type { UpsertStats, UpsertResult } from './upsert-tournament';
export { findOrCreatePlayer } from './player-matcher';
export type { MatchResult } from './player-matcher';
export { normalizeName, extractTitle, isLastFirstFormat } from './name-normalizer';
export { computeDiff } from './diff-engine';
export type { TournamentDiff } from './diff-engine';
export { startSyncScheduler, stopSyncScheduler } from './sync-scheduler';
