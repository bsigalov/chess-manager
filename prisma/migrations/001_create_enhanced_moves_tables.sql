-- Create enhanced moves tables migration
-- This migration adds games, moves, and move_annotations tables to support
-- comprehensive chess game data with multiple notation formats

-- Create games table
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pairing_id UUID NOT NULL UNIQUE,
    tournament_id UUID NOT NULL,
    white_player_id UUID NOT NULL,
    black_player_id UUID NOT NULL,
    round INTEGER NOT NULL,
    board INTEGER NOT NULL,
    result VARCHAR(10),
    pgn_header TEXT,
    pgn_movetext TEXT,
    eco_code VARCHAR(3),
    opening_name VARCHAR(255),
    time_control VARCHAR(100),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    termination VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_game_pairing FOREIGN KEY (pairing_id) 
        REFERENCES pairings(id) ON DELETE CASCADE,
    CONSTRAINT fk_game_tournament FOREIGN KEY (tournament_id) 
        REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT fk_game_white_player FOREIGN KEY (white_player_id) 
        REFERENCES players(id),
    CONSTRAINT fk_game_black_player FOREIGN KEY (black_player_id) 
        REFERENCES players(id),
    
    -- Unique constraint
    CONSTRAINT uq_game_tournament_round_board UNIQUE (tournament_id, round, board)
);

-- Create moves table
CREATE TABLE IF NOT EXISTS moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL,
    move_number INTEGER NOT NULL,
    color VARCHAR(5) NOT NULL CHECK (color IN ('white', 'black')),
    ply INTEGER NOT NULL,
    
    -- Notation formats
    san VARCHAR(10) NOT NULL,
    uci VARCHAR(5) NOT NULL,
    lan VARCHAR(7),
    
    -- Move details
    piece CHAR(1),
    from_square CHAR(2),
    to_square CHAR(2),
    promotion_piece CHAR(1),
    
    -- Special moves flags
    is_capture BOOLEAN DEFAULT FALSE,
    is_check BOOLEAN DEFAULT FALSE,
    is_checkmate BOOLEAN DEFAULT FALSE,
    is_castling BOOLEAN DEFAULT FALSE,
    is_en_passant BOOLEAN DEFAULT FALSE,
    
    -- Timing information
    clock_time_white INTEGER,
    clock_time_black INTEGER,
    think_time INTEGER,
    move_timestamp TIMESTAMP,
    
    -- Evaluation and analysis
    nag_codes INTEGER[],
    evaluation_cp INTEGER,
    evaluation_mate INTEGER,
    engine_depth INTEGER,
    best_move VARCHAR(5),
    
    -- Comments and variations
    comment TEXT,
    pre_comment TEXT,
    variations JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_move_game FOREIGN KEY (game_id) 
        REFERENCES games(id) ON DELETE CASCADE,
    
    -- Unique constraint
    CONSTRAINT uq_move_game_ply UNIQUE (game_id, ply)
);

-- Create move_annotations table
CREATE TABLE IF NOT EXISTS move_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    move_id UUID NOT NULL,
    annotation_type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_annotation_move FOREIGN KEY (move_id) 
        REFERENCES moves(id) ON DELETE CASCADE
);

-- Create indexes for games table
CREATE INDEX idx_games_tournament_round ON games(tournament_id, round);
CREATE INDEX idx_games_players ON games(white_player_id, black_player_id);
CREATE INDEX idx_games_eco ON games(eco_code) WHERE eco_code IS NOT NULL;
CREATE INDEX idx_games_result ON games(result) WHERE result IS NOT NULL;

-- Create indexes for moves table
CREATE INDEX idx_moves_game ON moves(game_id);
CREATE INDEX idx_moves_game_ply ON moves(game_id, ply);
CREATE INDEX idx_moves_san ON moves(san);
CREATE INDEX idx_moves_uci ON moves(uci);
CREATE INDEX idx_moves_squares ON moves(from_square, to_square);
CREATE INDEX idx_moves_evaluation ON moves(evaluation_cp) WHERE evaluation_cp IS NOT NULL;
CREATE INDEX idx_moves_timestamp ON moves(move_timestamp) WHERE move_timestamp IS NOT NULL;

-- Create indexes for move_annotations table
CREATE INDEX idx_annotations_move ON move_annotations(move_id);
CREATE INDEX idx_annotations_type ON move_annotations(annotation_type);

-- Create performance indexes (to be run after data load)
-- These are commented out and should be created with CONCURRENTLY after initial data load
-- CREATE INDEX CONCURRENTLY idx_moves_game_performance ON moves(game_id, ply);
-- CREATE INDEX CONCURRENTLY idx_games_tournament_performance ON games(tournament_id, round, board);
-- CREATE INDEX CONCURRENTLY idx_moves_position_search ON moves(from_square, to_square, piece);
-- CREATE INDEX CONCURRENTLY idx_games_opening_search ON games USING GIN(to_tsvector('english', opening_name));
-- CREATE INDEX CONCURRENTLY idx_moves_san_search ON moves USING GIN(to_tsvector('english', san));
-- CREATE INDEX CONCURRENTLY idx_moves_evaluation_analysis ON moves(evaluation_cp) WHERE evaluation_cp IS NOT NULL;
-- CREATE INDEX CONCURRENTLY idx_games_eco_stats ON games(eco_code, result) WHERE eco_code IS NOT NULL;
-- CREATE INDEX CONCURRENTLY idx_moves_timing ON moves(move_timestamp, think_time) WHERE move_timestamp IS NOT NULL;

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_moves_updated_at BEFORE UPDATE ON moves
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();