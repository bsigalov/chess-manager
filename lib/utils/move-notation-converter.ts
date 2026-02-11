/**
 * Move notation converter utility
 * Converts between different chess move notation formats:
 * - SAN (Standard Algebraic Notation): e4, Nf3, O-O
 * - UCI (Universal Chess Interface): e2e4, g1f3, e1g1
 * - LAN (Long Algebraic Notation): e2-e4, Ng1-f3, O-O
 */

export interface ChessPosition {
  board: string[][];
  turn: 'white' | 'black';
  castlingRights: {
    whiteKingside: boolean;
    whiteQueenside: boolean;
    blackKingside: boolean;
    blackQueenside: boolean;
  };
  enPassantTarget: string | null;
}

export interface MoveDetails {
  piece: string;
  from: string;
  to: string;
  promotion?: string;
  isCapture: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isCastling: 'kingside' | 'queenside' | false;
  isEnPassant: boolean;
}

export class MoveNotationConverter {
  private static readonly PIECE_SYMBOLS = {
    K: 'king',
    Q: 'queen',
    R: 'rook',
    B: 'bishop',
    N: 'knight',
    P: 'pawn'
  };

  private static readonly FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  private static readonly RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

  /**
   * Convert UCI notation to SAN
   * @param uci UCI move notation (e.g., "e2e4")
   * @param position Current chess position
   * @returns SAN notation (e.g., "e4")
   */
  static uciToSan(uci: string, position: ChessPosition): string {
    const moveDetails = this.parseMoveFromUci(uci, position);
    return this.moveDetailsToSan(moveDetails, position);
  }

  /**
   * Convert SAN notation to UCI
   * @param san SAN move notation (e.g., "e4")
   * @param position Current chess position
   * @returns UCI notation (e.g., "e2e4")
   */
  static sanToUci(san: string, position: ChessPosition): string {
    const moveDetails = this.parseMoveFromSan(san, position);
    return this.moveDetailsToUci(moveDetails);
  }

  /**
   * Convert UCI notation to LAN
   * @param uci UCI move notation (e.g., "e2e4")
   * @param position Current chess position
   * @returns LAN notation (e.g., "e2-e4")
   */
  static uciToLan(uci: string, position: ChessPosition): string {
    const moveDetails = this.parseMoveFromUci(uci, position);
    return this.moveDetailsToLan(moveDetails, position);
  }

  /**
   * Convert SAN notation to LAN
   * @param san SAN move notation (e.g., "e4")
   * @param position Current chess position
   * @returns LAN notation (e.g., "e2-e4")
   */
  static sanToLan(san: string, position: ChessPosition): string {
    const moveDetails = this.parseMoveFromSan(san, position);
    return this.moveDetailsToLan(moveDetails, position);
  }

  /**
   * Convert LAN notation to UCI
   * @param lan LAN move notation (e.g., "e2-e4")
   * @param position Current chess position
   * @returns UCI notation (e.g., "e2e4")
   */
  static lanToUci(lan: string, position: ChessPosition): string {
    const moveDetails = this.parseMoveFromLan(lan, position);
    return this.moveDetailsToUci(moveDetails);
  }

  /**
   * Convert LAN notation to SAN
   * @param lan LAN move notation (e.g., "e2-e4")
   * @param position Current chess position
   * @returns SAN notation (e.g., "e4")
   */
  static lanToSan(lan: string, position: ChessPosition): string {
    const moveDetails = this.parseMoveFromLan(lan, position);
    return this.moveDetailsToSan(moveDetails, position);
  }

  /**
   * Parse move details from UCI notation
   */
  private static parseMoveFromUci(uci: string, position: ChessPosition): MoveDetails {
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    
    // Detect castling
    let isCastling: 'kingside' | 'queenside' | false = false;
    if ((from === 'e1' && (to === 'g1' || to === 'c1')) ||
        (from === 'e8' && (to === 'g8' || to === 'c8'))) {
      const piece = this.getPieceAt(from, position);
      if (piece?.toLowerCase() === 'k') {
        isCastling = (to[0] === 'g') ? 'kingside' : 'queenside';
      }
    }
    
    const piece = this.getPieceAt(from, position) || 'p';
    const targetPiece = this.getPieceAt(to, position);
    const isCapture = targetPiece !== null;
    
    // Check for en passant
    const isEnPassant = piece.toLowerCase() === 'p' && 
                        to === position.enPassantTarget && 
                        Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 1;
    
    return {
      piece: piece.toUpperCase(),
      from,
      to,
      promotion: promotion?.toUpperCase(),
      isCapture: isCapture || isEnPassant,
      isCheck: false, // Would need position evaluation
      isCheckmate: false, // Would need position evaluation
      isCastling,
      isEnPassant
    };
  }

  /**
   * Parse move details from SAN notation
   */
  private static parseMoveFromSan(san: string, position: ChessPosition): MoveDetails {
    // Handle castling
    if (san === 'O-O' || san === '0-0') {
      const rank = position.turn === 'white' ? '1' : '8';
      return {
        piece: 'K',
        from: `e${rank}`,
        to: `g${rank}`,
        isCapture: false,
        isCheck: san.includes('+'),
        isCheckmate: san.includes('#'),
        isCastling: 'kingside',
        isEnPassant: false
      };
    }
    
    if (san === 'O-O-O' || san === '0-0-0') {
      const rank = position.turn === 'white' ? '1' : '8';
      return {
        piece: 'K',
        from: `e${rank}`,
        to: `c${rank}`,
        isCapture: false,
        isCheck: san.includes('+'),
        isCheckmate: san.includes('#'),
        isCastling: 'queenside',
        isEnPassant: false
      };
    }
    
    // Parse regular moves
    const cleanSan = san.replace(/[+#!?]/g, '');
    let piece = 'P';
    let from = '';
    let to = '';
    let promotion = '';
    let isCapture = san.includes('x');
    
    // Extract piece
    if (/^[KQRBN]/.test(cleanSan)) {
      piece = cleanSan[0];
    }
    
    // Extract destination
    const matches = cleanSan.match(/([a-h][1-8])(?:=([QRBN]))?$/);
    if (matches) {
      to = matches[1];
      promotion = matches[2] || '';
    }
    
    // Find the piece that can make this move
    from = this.findPieceSquare(piece, to, cleanSan, position);
    
    return {
      piece,
      from,
      to,
      promotion,
      isCapture,
      isCheck: san.includes('+'),
      isCheckmate: san.includes('#'),
      isCastling: false,
      isEnPassant: piece === 'P' && isCapture && this.getPieceAt(to, position) === null
    };
  }

  /**
   * Parse move details from LAN notation
   */
  private static parseMoveFromLan(lan: string, position: ChessPosition): MoveDetails {
    // Handle castling
    if (lan === 'O-O' || lan === '0-0') {
      const rank = position.turn === 'white' ? '1' : '8';
      return {
        piece: 'K',
        from: `e${rank}`,
        to: `g${rank}`,
        isCapture: false,
        isCheck: false,
        isCheckmate: false,
        isCastling: 'kingside',
        isEnPassant: false
      };
    }
    
    if (lan === 'O-O-O' || lan === '0-0-0') {
      const rank = position.turn === 'white' ? '1' : '8';
      return {
        piece: 'K',
        from: `e${rank}`,
        to: `c${rank}`,
        isCapture: false,
        isCheck: false,
        isCheckmate: false,
        isCastling: 'queenside',
        isEnPassant: false
      };
    }
    
    // Parse regular moves
    const cleanLan = lan.replace(/[+#!?]/g, '');
    const parts = cleanLan.split(/[-x]/);
    const isCapture = lan.includes('x');
    
    let piece = 'P';
    let from = parts[0];
    let to = parts[1];
    
    // Extract piece if specified
    if (/^[KQRBN]/.test(from)) {
      piece = from[0];
      from = from.slice(1);
    }
    
    // Handle promotion
    const promotionMatch = to.match(/=([QRBN])$/);
    const promotion = promotionMatch ? promotionMatch[1] : undefined;
    if (promotion) {
      to = to.replace(/=.*$/, '');
    }
    
    return {
      piece,
      from,
      to,
      promotion,
      isCapture,
      isCheck: lan.includes('+'),
      isCheckmate: lan.includes('#'),
      isCastling: false,
      isEnPassant: piece === 'P' && isCapture && this.getPieceAt(to, position) === null
    };
  }

  /**
   * Convert move details to UCI notation
   */
  private static moveDetailsToUci(move: MoveDetails): string {
    let uci = move.from + move.to;
    if (move.promotion) {
      uci += move.promotion.toLowerCase();
    }
    return uci;
  }

  /**
   * Convert move details to SAN notation
   */
  private static moveDetailsToSan(move: MoveDetails, position: ChessPosition): string {
    // Handle castling
    if (move.isCastling === 'kingside') {
      return 'O-O' + (move.isCheck ? '+' : '') + (move.isCheckmate ? '#' : '');
    }
    if (move.isCastling === 'queenside') {
      return 'O-O-O' + (move.isCheck ? '+' : '') + (move.isCheckmate ? '#' : '');
    }
    
    let san = '';
    
    // Add piece symbol (pawns don't have a symbol in SAN)
    if (move.piece !== 'P') {
      san += move.piece;
    }
    
    // Add disambiguation if needed
    const disambiguation = this.getDisambiguation(move, position);
    san += disambiguation;
    
    // Add capture symbol
    if (move.isCapture) {
      if (move.piece === 'P' && !disambiguation) {
        san += move.from[0]; // Add file for pawn captures
      }
      san += 'x';
    }
    
    // Add destination
    san += move.to;
    
    // Add promotion
    if (move.promotion) {
      san += '=' + move.promotion;
    }
    
    // Add check/checkmate symbols
    if (move.isCheckmate) {
      san += '#';
    } else if (move.isCheck) {
      san += '+';
    }
    
    return san;
  }

  /**
   * Convert move details to LAN notation
   */
  private static moveDetailsToLan(move: MoveDetails, position: ChessPosition): string {
    // Handle castling
    if (move.isCastling === 'kingside') {
      return 'O-O';
    }
    if (move.isCastling === 'queenside') {
      return 'O-O-O';
    }
    
    let lan = '';
    
    // Add piece symbol
    if (move.piece !== 'P') {
      lan += move.piece;
    }
    
    // Add source square
    lan += move.from;
    
    // Add separator
    lan += move.isCapture ? 'x' : '-';
    
    // Add destination
    lan += move.to;
    
    // Add promotion
    if (move.promotion) {
      lan += '=' + move.promotion;
    }
    
    // Add check/checkmate symbols
    if (move.isCheckmate) {
      lan += '#';
    } else if (move.isCheck) {
      lan += '+';
    }
    
    return lan;
  }

  /**
   * Get piece at a specific square
   */
  private static getPieceAt(square: string, position: ChessPosition): string | null {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(square[1]) - 1;
    
    if (file < 0 || file > 7 || rank < 0 || rank > 7) {
      return null;
    }
    
    return position.board[rank][file] || null;
  }

  /**
   * Find which piece can make a specific move (for SAN parsing)
   */
  private static findPieceSquare(
    piece: string,
    to: string,
    sanHint: string,
    position: ChessPosition
  ): string {
    // Implementation would need to check all possible pieces that could move to 'to'
    // and match against disambiguation hints in the SAN notation
    // This is a simplified version
    
    const candidates: string[] = [];
    
    // Search board for pieces of the correct type
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = this.FILES[file] + this.RANKS[rank];
        const boardPiece = this.getPieceAt(square, position);
        
        if (boardPiece?.toUpperCase() === piece) {
          // Check if this piece can move to the destination
          // (simplified - actual implementation would need move validation)
          candidates.push(square);
        }
      }
    }
    
    // Use disambiguation hints from SAN to find the correct piece
    // This is a simplified implementation
    return candidates[0] || '';
  }

  /**
   * Get disambiguation string for SAN notation
   */
  private static getDisambiguation(move: MoveDetails, position: ChessPosition): string {
    // Check if multiple pieces of the same type can move to the destination
    // Return file, rank, or both as needed for disambiguation
    // This is a simplified implementation
    return '';
  }
}