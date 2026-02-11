import { prisma } from '@/lib/db';

/**
 * Mark specific fields as manually overridden for a player.
 * These fields will be protected from automatic scraping updates.
 */
export async function setManualOverride(
  playerId: string,
  fields: string[]
): Promise<void> {
  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    select: { manualOverrides: true },
  });

  const existing = Array.isArray(player.manualOverrides)
    ? (player.manualOverrides as string[])
    : [];

  const merged = Array.from(new Set([...existing, ...fields]));

  await prisma.player.update({
    where: { id: playerId },
    data: { manualOverrides: merged },
  });
}

/**
 * Remove manual override protection from specific fields.
 */
export async function removeManualOverride(
  playerId: string,
  fields: string[]
): Promise<void> {
  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    select: { manualOverrides: true },
  });

  const existing = Array.isArray(player.manualOverrides)
    ? (player.manualOverrides as string[])
    : [];

  const filtered = existing.filter((f) => !fields.includes(f));

  await prisma.player.update({
    where: { id: playerId },
    data: { manualOverrides: filtered },
  });
}

/**
 * Get the list of manually overridden fields for a player.
 */
export async function getManualOverrides(
  playerId: string
): Promise<string[]> {
  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    select: { manualOverrides: true },
  });

  return Array.isArray(player.manualOverrides)
    ? (player.manualOverrides as string[])
    : [];
}

/**
 * Apply scraped data to a player, filtering out any manually overridden fields.
 * Returns the filtered data that was actually applied.
 */
export async function applyScrapedData(
  playerId: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const overrides = await getManualOverrides(playerId);

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!overrides.includes(key)) {
      filtered[key] = value;
    }
  }

  if (Object.keys(filtered).length > 0) {
    await prisma.player.update({
      where: { id: playerId },
      data: filtered,
    });
  }

  return filtered;
}
