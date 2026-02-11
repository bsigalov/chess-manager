/**
 * GET /api/import/jobs/[jobId]
 *
 * Returns the current status, result, or error of an import job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus } from '@/lib/import/import-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const job = await getJobStatus(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      sourceType: job.sourceType,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      result: job.resultData,
      error: job.error,
    });
  } catch (error) {
    console.error('[api/import/jobs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}
