import { ParsedPGN, PGNHeaders, ChessMove } from '@/lib/types/chess-moves';

/**
 * Parse one or more PGN games from a string.
 * Handles standard PGN format: headers in [ ] brackets followed by movetext.
 * Multiple games are separated by the result token followed by blank lines.
 */
export function parsePGN(pgnString: string): ParsedPGN[] {
  const games: ParsedPGN[] = [];
  const rawGames = splitGames(pgnString);

  for (const raw of rawGames) {
    try {
      const parsed = parseSingleGame(raw);
      if (parsed) games.push(parsed);
    } catch {
      // Skip malformed games silently — callers can check array length
    }
  }

  return games;
}

/**
 * Split a multi-game PGN string into individual game strings.
 * Games are delimited by a result marker (1-0, 0-1, 1/2-1/2, *) at the end
 * of the movetext, followed by one or more blank lines before the next header.
 */
function splitGames(pgn: string): string[] {
  const games: string[] = [];
  const lines = pgn.split(/\r?\n/);
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // A new header line after we already have content means a new game
    if (trimmed.startsWith('[') && current.length > 0 && hasMovetextContent(current)) {
      games.push(current.join('\n'));
      current = [];
    }

    current.push(line);
  }

  if (current.length > 0 && current.some((l) => l.trim().length > 0)) {
    games.push(current.join('\n'));
  }

  return games;
}

function hasMovetextContent(lines: string[]): boolean {
  return lines.some((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith('[');
  });
}

function parseSingleGame(text: string): ParsedPGN | null {
  const lines = text.split(/\r?\n/);
  const headers: PGNHeaders = {
    Event: '?',
    Site: '?',
    Date: '????.??.??',
    Round: '?',
    White: '?',
    Black: '?',
    Result: '*',
  };

  let movetextStart = 0;

  // Parse headers
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('[')) {
      const headerMatch = trimmed.match(/^\[(\w+)\s+"(.*)"\]$/);
      if (headerMatch) {
        headers[headerMatch[1]] = headerMatch[2];
      }
      movetextStart = i + 1;
    } else if (trimmed.length > 0 && movetextStart > 0) {
      // First non-empty, non-header line — start of movetext
      break;
    } else if (trimmed.length > 0 && movetextStart === 0) {
      // Movetext without headers
      break;
    }
  }

  const movetextLines = lines.slice(movetextStart);
  const movetext = movetextLines.join(' ').trim();

  if (!movetext && Object.keys(headers).length <= 7 && headers.Event === '?') {
    return null;
  }

  const result = parseResult(headers.Result);
  const { moves, comments, variations } = parseMovetext(movetext);

  return {
    headers,
    moves,
    comments,
    variations,
    result,
  };
}

function parseResult(resultStr: string): '1-0' | '0-1' | '1/2-1/2' | '*' {
  const r = resultStr.trim();
  if (r === '1-0') return '1-0';
  if (r === '0-1') return '0-1';
  if (r === '1/2-1/2') return '1/2-1/2';
  return '*';
}

interface MoveParseResult {
  moves: ChessMove[];
  comments: { [ply: number]: string };
  variations: { [ply: number]: never[] };
}

function parseMovetext(movetext: string): MoveParseResult {
  const moves: ChessMove[] = [];
  const comments: { [ply: number]: string } = {};

  // Strip variations (parenthesized groups, possibly nested)
  let cleaned = stripVariations(movetext);

  // Extract and store comments
  cleaned = extractComments(cleaned, comments, () => moves.length);

  // Remove result tokens at the end
  cleaned = cleaned.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, '');

  // Tokenize
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);

  let moveNumber = 1;
  let ply = 1;

  for (const token of tokens) {
    // Skip move number tokens like "1." or "1..."
    if (/^\d+\.+$/.test(token)) {
      const num = parseInt(token, 10);
      if (!isNaN(num)) moveNumber = num;
      continue;
    }

    // Skip NAG codes (store them on the previous move)
    if (token.startsWith('$')) {
      const nagCode = parseInt(token.slice(1), 10);
      if (!isNaN(nagCode) && moves.length > 0) {
        const lastMove = moves[moves.length - 1];
        if (!lastMove.nagCodes) lastMove.nagCodes = [];
        lastMove.nagCodes.push(nagCode);
      }
      continue;
    }

    // Skip result tokens that appear mid-text
    if (['1-0', '0-1', '1/2-1/2', '*'].includes(token)) {
      continue;
    }

    // Handle combined move number + SAN like "1.e4"
    let san = token;
    const combinedMatch = token.match(/^(\d+)\.(\.\.)?(.+)$/);
    if (combinedMatch) {
      const num = parseInt(combinedMatch[1], 10);
      if (!isNaN(num)) moveNumber = num;
      san = combinedMatch[3];
      if (combinedMatch[2]) {
        // "1...Nf6" — black move
      }
    }

    // Validate SAN: must start with a piece letter, pawn file, or castle notation
    if (!isValidSAN(san)) continue;

    const color: 'white' | 'black' = ply % 2 === 1 ? 'white' : 'black';

    const move: ChessMove = {
      gameId: '',
      moveNumber,
      color,
      ply,
      san,
      uci: '',
      isCapture: san.includes('x'),
      isCheck: san.includes('+') || san.includes('#'),
      isCheckmate: san.includes('#'),
      isCastling: san === 'O-O' || san === 'O-O-O',
      isEnPassant: false,
    };

    // Extract piece
    if (move.isCastling) {
      move.piece = 'K';
    } else {
      const pieceMatch = san.match(/^([KQRBN])/);
      move.piece = pieceMatch ? pieceMatch[1] : 'P';
    }

    // Check promotion
    const promoMatch = san.match(/=([QRBN])$/);
    if (promoMatch) {
      move.promotionPiece = promoMatch[1];
    }

    moves.push(move);

    if (color === 'black') moveNumber++;
    ply++;
  }

  return { moves, comments, variations: {} };
}

function isValidSAN(san: string): boolean {
  if (!san || san.length === 0) return false;
  // Castle
  if (san === 'O-O' || san === 'O-O-O') return true;
  // Piece moves: Nf3, Bxe5+, Qd1#, Rae1, R1e1
  // Pawn moves: e4, exd5, e8=Q, e8=Q+
  return /^[KQRBN][a-h1-8x]/.test(san) || /^[a-h][1-8x=+#]/.test(san);
}

/**
 * Remove all variation blocks (...) including nested ones.
 */
function stripVariations(text: string): string {
  let result = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0) {
      result += ch;
    }
  }
  return result;
}

/**
 * Extract comments in { } braces from movetext, storing them keyed by the
 * current ply count (so they attach to the move before them).
 */
function extractComments(
  text: string,
  comments: { [ply: number]: string },
  getCurrentPly: () => number
): string {
  let result = '';
  let insideComment = false;
  let commentBuffer = '';

  for (const ch of text) {
    if (ch === '{') {
      insideComment = true;
      commentBuffer = '';
    } else if (ch === '}') {
      insideComment = false;
      const ply = getCurrentPly();
      const trimmed = commentBuffer.trim();
      if (trimmed) {
        comments[ply] = comments[ply] ? comments[ply] + ' ' + trimmed : trimmed;
      }
    } else if (insideComment) {
      commentBuffer += ch;
    } else {
      result += ch;
    }
  }

  return result;
}
