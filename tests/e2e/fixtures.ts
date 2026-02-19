/**
 * Stable test fixtures — IDs of tournaments/players known to exist in the dev DB.
 * Using direct navigation (page.goto) is more reliable than clicking through the UI.
 */
export const TOURNAMENT_ID = "9458ecd7-8671-4871-9ad3-fb6d661044f6"; // Dov Porat Memorial 2025 - Rapid B
export const TOURNAMENT_URL = `/tournaments/${TOURNAMENT_ID}`;
export const PLAYER_RANK = 1; // Rank 1 in that tournament
export const PLAYER_TOURNAMENT_URL = `${TOURNAMENT_URL}/players/${PLAYER_RANK}`;
