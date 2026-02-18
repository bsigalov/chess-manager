import type {
  CrosstableEntry,
  HypotheticalResult,
} from "@/lib/types/tournament";
import { computeStandings } from "@/lib/analytics/standings";

/**
 * Apply hypothetical results to a crosstable.
 *
 * Deep-clones the crosstable, then for each hypothetical:
 *   - Finds the player by `playerRank` and adds/replaces the round result
 *   - Also updates the opponent's round result with the inverse score
 *   - Recalculates both players' `points` from their round results
 *
 * Returns the modified crosstable without mutating the original.
 */
export function applyHypotheticalResults(
  crosstable: CrosstableEntry[],
  hypotheticals: HypotheticalResult[]
): CrosstableEntry[] {
  // Deep-clone: structuredClone handles nested arrays/objects
  const cloned: CrosstableEntry[] = structuredClone(crosstable);

  for (const hyp of hypotheticals) {
    const player = cloned.find((e) => e.startingRank === hyp.playerRank);
    const opponent = cloned.find((e) => e.startingRank === hyp.opponentRank);
    if (!player || !opponent) continue;

    // Determine inverse score
    const inverseScore = 1 - hyp.score;

    // Update player's round result (add or replace)
    upsertRoundResult(player, {
      round: hyp.round,
      opponentRank: hyp.opponentRank,
      color: "w", // default; color is secondary for what-if analysis
      score: hyp.score,
      isForfeit: false,
      isBye: false,
    });

    // Update opponent's round result (inverse)
    upsertRoundResult(opponent, {
      round: hyp.round,
      opponentRank: hyp.playerRank,
      color: "b",
      score: inverseScore,
      isForfeit: false,
      isBye: false,
    });

    // Recalculate points for both
    player.points = player.roundResults.reduce((s, rr) => s + rr.score, 0);
    opponent.points = opponent.roundResults.reduce((s, rr) => s + rr.score, 0);
  }

  return cloned;
}

/**
 * Add or replace a round result in a player's roundResults array.
 */
function upsertRoundResult(
  entry: CrosstableEntry,
  result: CrosstableEntry["roundResults"][number]
): void {
  const idx = entry.roundResults.findIndex((rr) => rr.round === result.round);
  if (idx >= 0) {
    entry.roundResults[idx] = result;
  } else {
    entry.roundResults.push(result);
  }
}

/**
 * Determine what a player needs to reach a target position.
 *
 * Logic:
 *   1. Compute current standings
 *   2. If the player is already at or above the target position, report that
 *   3. Calculate max possible points (current + remaining rounds * 1)
 *   4. If max possible < points of player currently at target position, impossible
 *   5. Otherwise report how many points are needed from remaining games
 */
export function whatDoesPlayerNeed(
  playerRank: number,
  crosstable: CrosstableEntry[],
  totalRounds: number,
  targetPosition: number
): string {
  const standings = computeStandings(crosstable);

  const playerStanding = standings.find((s) => s.startingRank === playerRank);
  if (!playerStanding) {
    return `Player with starting rank ${playerRank} not found`;
  }

  // Current position
  if (playerStanding.rank <= targetPosition) {
    return `Already at position ${playerStanding.rank}`;
  }

  // How many rounds has the player played?
  const playerEntry = crosstable.find((e) => e.startingRank === playerRank);
  if (!playerEntry) {
    return `Player with starting rank ${playerRank} not found`;
  }
  const completedRounds = playerEntry.roundResults.length;
  const remainingRounds = totalRounds - completedRounds;

  // Max possible points
  const maxPossiblePoints = playerStanding.points + remainingRounds;

  // Points of the player currently at the target position
  const targetStanding = standings.find((s) => s.rank === targetPosition);
  if (!targetStanding) {
    return `No player currently at position ${targetPosition}`;
  }
  const targetPoints = targetStanding.points;

  if (maxPossiblePoints < targetPoints) {
    return `Cannot reach position ${targetPosition}`;
  }

  // Points needed from remaining games
  const pointsNeeded = targetPoints - playerStanding.points;

  if (remainingRounds === 0) {
    // No remaining rounds but not mathematically impossible means tiebreaks
    return `Cannot reach position ${targetPosition}`;
  }

  return `Needs ${pointsNeeded} points from ${remainingRounds} remaining games`;
}
