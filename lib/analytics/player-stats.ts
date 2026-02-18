import type { CrosstableEntry, PlayerStats } from "@/lib/types/tournament";

/**
 * Compute comprehensive player statistics from crosstable data.
 *
 * Performance rating uses the formula: avgOpponentRating + 400 * (W - L) / N
 * where W = wins, L = losses, N = total rated games.
 */
export function computePlayerStats(
  playerRank: number,
  crosstable: CrosstableEntry[]
): PlayerStats {
  const player = crosstable.find((e) => e.startingRank === playerRank);
  if (!player) {
    throw new Error(`Player with rank ${playerRank} not found in crosstable`);
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let whiteGames = 0;
  let blackGames = 0;
  let whiteScore = 0;
  let blackScore = 0;
  let opponentRatingSum = 0;
  let ratedOpponentCount = 0;
  const scoreProgression: number[] = [];
  let cumulativeScore = 0;

  for (const result of player.roundResults) {
    cumulativeScore += result.score;
    scoreProgression.push(cumulativeScore);

    // W/D/L counts
    if (result.score === 1) {
      wins++;
    } else if (result.score === 0.5) {
      draws++;
    } else {
      losses++;
    }

    // Color stats (BYEs have null color)
    if (result.color === "w") {
      whiteGames++;
      whiteScore += result.score;
    } else if (result.color === "b") {
      blackGames++;
      blackScore += result.score;
    }

    // Opponent rating for average calculation
    if (!result.isBye && result.opponentRank !== null) {
      const opponent = crosstable.find(
        (e) => e.startingRank === result.opponentRank
      );
      if (opponent?.rating != null) {
        opponentRatingSum += opponent.rating;
        ratedOpponentCount++;
      }
    }
  }

  const averageOpponentRating =
    ratedOpponentCount > 0
      ? Math.round(opponentRatingSum / ratedOpponentCount)
      : null;

  // Performance rating: avgOppRating + 400 * (W - L) / N
  // Only calculable when there are rated opponents
  let performanceRating: number | null = null;
  if (averageOpponentRating !== null && ratedOpponentCount > 0) {
    performanceRating = Math.round(
      averageOpponentRating + (400 * (wins - losses)) / ratedOpponentCount
    );
  }

  return {
    startingRank: player.startingRank,
    name: player.name,
    rating: player.rating,
    wins,
    draws,
    losses,
    whiteGames,
    blackGames,
    whiteScore,
    blackScore,
    averageOpponentRating,
    performanceRating,
    scoreProgression,
  };
}
