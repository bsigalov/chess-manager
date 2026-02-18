import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { captureSnapshot, getSnapshots } from '@/lib/data-quality/snapshot-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    const snapshots = await getSnapshots(id);
    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error('Failed to fetch snapshots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      select: { id: true, rounds: true },
    });

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const round = body?.round;

    if (typeof round !== 'number' || round < 1) {
      return NextResponse.json(
        { error: 'Invalid round number. Must be a positive integer.' },
        { status: 400 }
      );
    }

    if (round > tournament.rounds) {
      return NextResponse.json(
        { error: `Round ${round} exceeds tournament total of ${tournament.rounds} rounds` },
        { status: 400 }
      );
    }

    await captureSnapshot(id, round);

    return NextResponse.json(
      { success: true, round },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to capture snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to capture snapshot' },
      { status: 500 }
    );
  }
}
