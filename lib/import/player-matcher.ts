/**
 * Player matching and deduplication.
 *
 * Resolves a NormalizedPlayer to a database Player record using a tiered
 * matching strategy:
 *   1. Exact FIDE ID match (highest confidence)
 *   2. Normalized name + country + similar rating (fuzzy match)
 *   3. Create new player (no match found)
 *
 * IMPORTANT: Never generates fake FIDE IDs like "nofide-{name}".
 * If a player has no FIDE ID, the fideId field stays null.
 */

import { prisma } from '@/lib/db';
import { NormalizedPlayer } from '@/lib/providers/types';
import { normalizeName } from './name-normalizer';

const RATING_TOLERANCE = 50;

export interface MatchResult {
  id: string;
  created: boolean;
}

/**
 * Find an existing player or create a new one.
 */
export async function findOrCreatePlayer(
  player: NormalizedPlayer
): Promise<MatchResult> {
  // 1. Exact FIDE ID match
  if (player.fideId) {
    const byFide = await prisma.player.findUnique({
      where: { fideId: player.fideId },
    });
    if (byFide) {
      // Update mutable fields if provider has newer data
      await prisma.player.update({
        where: { id: byFide.id },
        data: {
          name: player.name,
          title: player.title ?? byFide.title,
          rating: player.rating ?? byFide.rating,
          country: player.country ?? byFide.country,
          lastUpdated: new Date(),
        },
      });
      return { id: byFide.id, created: false };
    }
  }

  // 2. Fuzzy match: normalized name + country + similar rating
  //    Query candidates narrowed by country when available, then compare
  //    normalized names in-memory.
  const normalized = normalizeName(player.name);
  if (normalized) {
    const whereClause: Record<string, unknown> = {};
    if (player.country) {
      whereClause.country = player.country;
    }

    const candidates = await prisma.player.findMany({
      where: whereClause,
      take: 500, // Reasonable cap to avoid full table scans
    });

    for (const candidate of candidates) {
      const candidateNormalized = normalizeName(candidate.name);
      if (candidateNormalized !== normalized) continue;

      // If both have ratings, check they're within tolerance
      if (
        player.rating != null &&
        candidate.rating != null &&
        Math.abs(player.rating - candidate.rating) > RATING_TOLERANCE
      ) {
        continue;
      }

      // Match found -- update with any new data
      await prisma.player.update({
        where: { id: candidate.id },
        data: {
          fideId: player.fideId ?? candidate.fideId,
          title: player.title ?? candidate.title,
          rating: player.rating ?? candidate.rating,
          country: player.country ?? candidate.country,
          lastUpdated: new Date(),
        },
      });
      return { id: candidate.id, created: false };
    }
  }

  // 3. No match -- create new player
  const created = await prisma.player.create({
    data: {
      fideId: player.fideId || null, // Never store fake IDs
      name: player.name,
      title: player.title,
      rating: player.rating,
      country: player.country,
    },
  });

  return { id: created.id, created: true };
}
