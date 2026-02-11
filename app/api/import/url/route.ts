/**
 * POST /api/import/url
 *
 * Import a tournament from a URL. Detects the source type from the URL
 * and creates an async import job.
 *
 * Body: { url: string }
 * Returns: 202 { jobId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SourceType } from '@/lib/providers/types';
import { createImportJob } from '@/lib/import/import-service';
import { enqueueImportJob } from '@/lib/import/import-worker';

/**
 * Detect the source type from a URL.
 */
function detectSourceType(url: string): SourceType | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('chess-results.com')) return 'chess-results';
    if (host.includes('lichess.org')) return 'lichess';
    if (host.includes('chess.com')) return 'chesscom';
    if (host.includes('fide.com') || host.includes('ratings.fide.com'))
      return 'fide';

    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const sourceType = detectSourceType(url);
    if (!sourceType) {
      return NextResponse.json(
        {
          error:
            'Unsupported URL. Supported sources: chess-results.com, lichess.org, chess.com, fide.com',
        },
        { status: 400 }
      );
    }

    const jobId = await createImportJob({ sourceType, url });
    await enqueueImportJob(jobId);

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    console.error('[api/import/url] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create import job',
      },
      { status: 500 }
    );
  }
}
