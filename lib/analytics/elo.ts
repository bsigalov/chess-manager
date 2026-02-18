import type { RatingStep } from "@/lib/types/tournament";

/**
 * FIDE expected score: probability that player A scores against player B.
 * Formula: 1 / (1 + 10^((Rb - Ra) / 400))
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * FIDE K-factor based on player rating.
 *  - 40 for rating < 2300
 *  - 20 for 2300-2399
 *  - 10 for 2400+
 */
export function kFactor(rating: number): number {
  if (rating < 2300) return 40;
  if (rating < 2400) return 20;
  return 10;
}

/**
 * Single-game rating change: K * (result - expected).
 * Result is 1 (win), 0.5 (draw), or 0 (loss).
 */
export function ratingChange(
  playerRating: number,
  opponentRating: number,
  result: number
): number {
  const K = kFactor(playerRating);
  const expected = expectedScore(playerRating, opponentRating);
  return K * (result - expected);
}

/**
 * Compute a running ELO progression across multiple rounds.
 * Games with null opponentRating (BYEs/forfeits) are included in the output
 * but contribute zero rating change.
 */
export function computeRatingProgression(
  startRating: number,
  games: { opponentRating: number | null; result: number; round: number }[]
): RatingStep[] {
  let currentRating = startRating;
  const steps: RatingStep[] = [];

  for (const game of games) {
    if (game.opponentRating === null) {
      steps.push({
        round: game.round,
        opponentRating: null,
        result: game.result,
        expectedScore: 0,
        ratingChange: 0,
        ratingAfter: currentRating,
      });
      continue;
    }

    const expected = expectedScore(currentRating, game.opponentRating);
    const change = ratingChange(currentRating, game.opponentRating, game.result);
    currentRating += change;

    steps.push({
      round: game.round,
      opponentRating: game.opponentRating,
      result: game.result,
      expectedScore: expected,
      ratingChange: change,
      ratingAfter: currentRating,
    });
  }

  return steps;
}

/**
 * Estimate win/draw/loss probabilities for a game (from White's perspective).
 * Applies ~50 Elo white advantage. Draw rate model:
 *   expected = FIDE expected score (with white bonus)
 *   draw = min(2 * expected * (1 - expected), 0.5)
 *   win  = expected - draw / 2
 *   loss = 1 - win - draw
 */
export function winDrawLossProbability(
  whiteElo: number,
  blackElo: number
): { win: number; draw: number; loss: number } {
  const whiteAdvantage = 50;
  const expected = expectedScore(whiteElo + whiteAdvantage, blackElo);
  const draw = Math.min(2 * expected * (1 - expected), 0.5);
  const win = expected - draw / 2;
  const loss = 1 - win - draw;

  return { win, draw, loss };
}

/**
 * Tournament Performance Rating (TPR).
 * Formula: average opponent rating + 400 * (W - L) / N
 * Edge cases:
 *  - All wins:  avg opponent rating + 400
 *  - All losses: avg opponent rating - 400
 *  - No games with rated opponents: returns 0
 */
export function performanceRating(
  results: { opponentRating: number; result: number }[]
): number {
  if (results.length === 0) return 0;

  const N = results.length;
  const avgOpponent =
    results.reduce((sum, r) => sum + r.opponentRating, 0) / N;
  const wins = results.reduce((sum, r) => sum + r.result, 0);
  const losses = N - wins; // since W + D/2 contributes, but W-L = score - (N - score) = 2*score - N

  // W - L where W counts as 1, D as 0.5, L as 0
  // So wins (sum of results) minus losses: score - (N - score) = 2*score - N
  const score = results.reduce((sum, r) => sum + r.result, 0);
  let diff = (2 * score - N) / N; // (W - L) / N normalized

  // Cap at +/- 1 for all-win / all-loss
  diff = Math.max(-1, Math.min(1, diff));

  return avgOpponent + 400 * diff;
}
