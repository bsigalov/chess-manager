/**
 * Chess player name normalization utilities.
 *
 * Handles the various formats found across chess data sources:
 *   - "Last, First" (chess-results.com standard)
 *   - "GM First Last" (title embedded)
 *   - Extra whitespace, mixed case, etc.
 */

const CHESS_TITLES = [
  'GM', 'IM', 'FM', 'CM', 'WGM', 'WIM', 'WFM', 'WCM',
  'NM', 'FIDE', 'AGM', 'AIM', 'AFM', 'ACM',
] as const;

const TITLE_PATTERN = new RegExp(
  `^(${CHESS_TITLES.join('|')})\\s+`,
  'i'
);

/**
 * Check if a name is in "Last, First" format.
 */
export function isLastFirstFormat(name: string): boolean {
  return name.includes(',');
}

/**
 * Extract a chess title if it appears at the start of the name string.
 * Returns the canonical uppercase title or null.
 */
export function extractTitle(name: string): string | null {
  const trimmed = name.trim();
  const match = trimmed.match(TITLE_PATTERN);
  if (!match) return null;
  return match[1].toUpperCase();
}

/**
 * Convert a string to title case (first letter of each word capitalized).
 */
function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (ch) => ch.toUpperCase());
}

/**
 * Normalize a player name for consistent matching:
 *   1. Convert "Last, First" -> "First Last"
 *   2. Strip chess titles from start
 *   3. Collapse whitespace
 *   4. Trim
 *   5. Title case
 */
export function normalizeName(name: string): string {
  let result = name.trim();
  if (!result) return '';

  // Strip title from start if present
  result = result.replace(TITLE_PATTERN, '');

  // Convert "Last, First" to "First Last"
  if (isLastFirstFormat(result)) {
    const parts = result.split(',').map((p) => p.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      result = `${parts[1]} ${parts[0]}`;
    }
  }

  // Collapse multiple whitespace to single space
  result = result.replace(/\s+/g, ' ').trim();

  // Title case
  result = toTitleCase(result);

  return result;
}
