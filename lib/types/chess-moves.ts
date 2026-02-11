/**
 * Chess move types and interfaces
 */

export interface ChessMove {
  id?: string;
  gameId: string;
  moveNumber: number;
  color: 'white' | 'black';
  ply: number;
  san: string;
  uci: string;
  lan?: string;
  piece?: string;
  fromSquare?: string;
  toSquare?: string;
  promotionPiece?: string;
  isCapture: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isCastling: boolean;
  isEnPassant: boolean;
  clockTimeWhite?: number;
  clockTimeBlack?: number;
  thinkTime?: number;
  moveTimestamp?: Date;
  nagCodes?: number[];
  evaluationCp?: number;
  evaluationMate?: number;
  engineDepth?: number;
  bestMove?: string;
  comment?: string;
  preComment?: string;
  variations?: MoveVariation[];
}

export interface MoveVariation {
  moves: ChessMove[];
  comment?: string;
  evaluation?: MoveEvaluation;
}

export interface MoveEvaluation {
  centipawns?: number;
  mate?: number;
  depth: number;
  engine: string;
  bestLine?: string[];
}

export interface GameMoveData {
  gameId: string;
  moves: ChessMove[];
  startingPosition?: string; // FEN
  timeControl?: string;
}

export interface MoveAnnotationData {
  moveId: string;
  annotationType: 'engine_line' | 'book_reference' | 'historical_game' | 'comment' | 'diagram';
  data: {
    [key: string]: any;
  };
  source?: string;
}

export const NAG_CODES = {
  1: 'Good move',
  2: 'Poor move',
  3: 'Excellent move',
  4: 'Blunder',
  5: 'Interesting move',
  6: 'Dubious move',
  7: 'Only move',
  8: 'Equal position',
  9: 'White slightly better',
  10: 'Black slightly better',
  11: 'White better',
  12: 'Black better',
  13: 'White winning',
  14: 'Black winning',
  15: 'Unclear position',
  16: 'White has compensation',
  17: 'Black has compensation',
  18: 'White has initiative',
  19: 'Black has initiative',
  20: 'White has attack',
  21: 'Black has attack',
  22: 'White zugzwang',
  23: 'Black zugzwang',
  // ... more NAG codes
} as const;

export type NAGCode = keyof typeof NAG_CODES;

export interface PGNHeaders {
  Event: string;
  Site: string;
  Date: string;
  Round: string;
  White: string;
  Black: string;
  Result: string;
  WhiteElo?: string;
  BlackElo?: string;
  ECO?: string;
  Opening?: string;
  TimeControl?: string;
  Termination?: string;
  [key: string]: string | undefined;
}

export interface ParsedPGN {
  headers: PGNHeaders;
  moves: ChessMove[];
  comments: { [ply: number]: string };
  variations: { [ply: number]: MoveVariation[] };
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
}