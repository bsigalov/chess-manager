/**
 * POST /api/import/file
 *
 * Import a tournament from an uploaded file (PGN, CSV).
 * Accepts multipart form data with a "file" field.
 *
 * Returns: 202 { jobId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SourceType } from '@/lib/providers/types';
import { createImportJob } from '@/lib/import/import-service';
import { enqueueImportJob } from '@/lib/import/import-worker';

/**
 * Detect source type from file extension.
 */
function detectSourceTypeFromFilename(
  filename: string
): SourceType | null {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pgn':
      return 'pgn-file';
    case 'csv':
      return 'csv-file';
    default:
      return null;
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'A file field is required' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10 MB.' },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const sourceType = detectSourceTypeFromFilename(fileName);
    if (!sourceType) {
      return NextResponse.json(
        { error: 'Unsupported file type. Supported: .pgn, .csv' },
        { status: 400 }
      );
    }

    const fileContent = await file.text();

    const jobId = await createImportJob({
      sourceType,
      fileContent,
      fileName,
    });
    await enqueueImportJob(jobId);

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    console.error('[api/import/file] Error:', error);
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
