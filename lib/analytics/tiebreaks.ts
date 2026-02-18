import type { CrosstableEntry } from "@/lib/types/tournament";

/**
 * Buchholz tiebreak: sum of all opponents' total points.
 * For BYE rounds (opponentRank is null), substitute the player's own points.
 */
export function buchholz(
  playerRank: number,
  crosstable: CrosstableEntry[]
): number {
  const player = crosstable.find((e) => e.startingRank === playerRank);
  if (!player) {
    throw new Error(`Player with rank ${playerRank} not found in crosstable`);
  }

  let sum = 0;
  for (const result of player.roundResults) {
    if (result.isBye || result.opponentRank === null) {
      // BYE: use the player's own points as substitute
      sum += player.points;
    } else {
      const opponent = crosstable.find(
        (e) => e.startingRank === result.opponentRank
      );
      if (!opponent) {
        throw new Error(
          `Opponent with rank ${result.opponentRank} not found in crosstable`
        );
      }
      sum += opponent.points;
    }
  }

  return sum;
}

/**
 * Sonneborn-Berger tiebreak: sum of (opponent's points * score against that opponent).
 * Win = full opponent points, draw = half opponent points, loss = 0.
 * BYE rounds are excluded (contribute 0).
 */
export function sonnebornBerger(
  playerRank: number,
  crosstable: CrosstableEntry[]
): number {
  const player = crosstable.find((e) => e.startingRank === playerRank);
  if (!player) {
    throw new Error(`Player with rank ${playerRank} not found in crosstable`);
  }

  let sum = 0;
  for (const result of player.roundResults) {
    if (result.isBye || result.opponentRank === null) {
      continue;
    }

    const opponent = crosstable.find(
      (e) => e.startingRank === result.opponentRank
    );
    if (!opponent) {
      throw new Error(
        `Opponent with rank ${result.opponentRank} not found in crosstable`
      );
    }

    sum += opponent.points * result.score;
  }

  return sum;
}
