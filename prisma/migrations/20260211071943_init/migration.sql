-- CreateEnum
CREATE TYPE "Color" AS ENUM ('white', 'black');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "venue" VARCHAR(255),
    "city" VARCHAR(100),
    "country" VARCHAR(100),
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "rounds" INTEGER NOT NULL,
    "current_round" INTEGER NOT NULL DEFAULT 0,
    "time_control" VARCHAR(100),
    "tournament_type" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL,
    "source_url" TEXT NOT NULL,
    "is_followed" BOOLEAN NOT NULL DEFAULT false,
    "last_scraped_at" TIMESTAMP(3),
    "scraping_frequency_mins" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fide_id" VARCHAR(20),
    "name" VARCHAR(255) NOT NULL,
    "title" VARCHAR(10),
    "rating" INTEGER,
    "rapid_rating" INTEGER,
    "blitz_rating" INTEGER,
    "country" VARCHAR(3),
    "birth_year" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "starting_rank" INTEGER,
    "current_rank" INTEGER,
    "starting_rating" INTEGER,
    "current_rating" INTEGER,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "performance" INTEGER,
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pairings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "round" INTEGER NOT NULL,
    "board" INTEGER NOT NULL,
    "white_player_id" UUID,
    "black_player_id" UUID,
    "result" VARCHAR(10),
    "white_elo" INTEGER,
    "black_elo" INTEGER,
    "played_at" TIMESTAMP(3),
    "pgn" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pairings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followed_players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(255) NOT NULL,
    "player_id" UUID NOT NULL,
    "alias" VARCHAR(255),
    "notifications" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "followed_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pairing_id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "white_player_id" UUID NOT NULL,
    "black_player_id" UUID NOT NULL,
    "round" INTEGER NOT NULL,
    "board" INTEGER NOT NULL,
    "result" VARCHAR(10),
    "pgn_header" TEXT,
    "pgn_movetext" TEXT,
    "eco_code" VARCHAR(3),
    "opening_name" VARCHAR(255),
    "time_control" VARCHAR(100),
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "termination" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moves" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "game_id" UUID NOT NULL,
    "move_number" INTEGER NOT NULL,
    "color" "Color" NOT NULL,
    "ply" INTEGER NOT NULL,
    "san" VARCHAR(10) NOT NULL,
    "uci" VARCHAR(5) NOT NULL,
    "lan" VARCHAR(7),
    "piece" CHAR(1),
    "from_square" CHAR(2),
    "to_square" CHAR(2),
    "promotion_piece" CHAR(1),
    "is_capture" BOOLEAN NOT NULL DEFAULT false,
    "is_check" BOOLEAN NOT NULL DEFAULT false,
    "is_checkmate" BOOLEAN NOT NULL DEFAULT false,
    "is_castling" BOOLEAN NOT NULL DEFAULT false,
    "is_en_passant" BOOLEAN NOT NULL DEFAULT false,
    "clock_time_white" INTEGER,
    "clock_time_black" INTEGER,
    "think_time" INTEGER,
    "move_timestamp" TIMESTAMP(3),
    "nag_codes" INTEGER[],
    "evaluation_cp" INTEGER,
    "evaluation_mate" INTEGER,
    "engine_depth" INTEGER,
    "best_move" VARCHAR(5),
    "comment" TEXT,
    "pre_comment" TEXT,
    "variations" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "move_annotations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "move_id" UUID NOT NULL,
    "annotation_type" VARCHAR(50) NOT NULL,
    "data" JSONB NOT NULL,
    "source" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "move_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraping_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "job_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraping_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" VARCHAR(255) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_external_id_key" ON "tournaments"("external_id");

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournaments_is_followed_idx" ON "tournaments"("is_followed");

-- CreateIndex
CREATE INDEX "tournaments_last_scraped_at_idx" ON "tournaments"("last_scraped_at");

-- CreateIndex
CREATE UNIQUE INDEX "players_fide_id_key" ON "players"("fide_id");

-- CreateIndex
CREATE INDEX "players_name_idx" ON "players"("name");

-- CreateIndex
CREATE INDEX "players_rating_idx" ON "players"("rating");

-- CreateIndex
CREATE INDEX "players_country_idx" ON "players"("country");

-- CreateIndex
CREATE INDEX "tournament_players_current_rank_idx" ON "tournament_players"("current_rank");

-- CreateIndex
CREATE INDEX "tournament_players_points_idx" ON "tournament_players"("points");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_players_tournament_id_player_id_key" ON "tournament_players"("tournament_id", "player_id");

-- CreateIndex
CREATE INDEX "pairings_tournament_id_round_idx" ON "pairings"("tournament_id", "round");

-- CreateIndex
CREATE UNIQUE INDEX "pairings_tournament_id_round_board_key" ON "pairings"("tournament_id", "round", "board");

-- CreateIndex
CREATE UNIQUE INDEX "followed_players_user_id_player_id_key" ON "followed_players"("user_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "games_pairing_id_key" ON "games"("pairing_id");

-- CreateIndex
CREATE INDEX "games_tournament_id_round_idx" ON "games"("tournament_id", "round");

-- CreateIndex
CREATE INDEX "games_white_player_id_black_player_id_idx" ON "games"("white_player_id", "black_player_id");

-- CreateIndex
CREATE INDEX "games_eco_code_idx" ON "games"("eco_code");

-- CreateIndex
CREATE INDEX "games_result_idx" ON "games"("result");

-- CreateIndex
CREATE UNIQUE INDEX "games_tournament_id_round_board_key" ON "games"("tournament_id", "round", "board");

-- CreateIndex
CREATE INDEX "moves_game_id_idx" ON "moves"("game_id");

-- CreateIndex
CREATE INDEX "moves_game_id_ply_idx" ON "moves"("game_id", "ply");

-- CreateIndex
CREATE INDEX "moves_san_idx" ON "moves"("san");

-- CreateIndex
CREATE INDEX "moves_uci_idx" ON "moves"("uci");

-- CreateIndex
CREATE INDEX "moves_from_square_to_square_idx" ON "moves"("from_square", "to_square");

-- CreateIndex
CREATE INDEX "moves_evaluation_cp_idx" ON "moves"("evaluation_cp");

-- CreateIndex
CREATE INDEX "moves_move_timestamp_idx" ON "moves"("move_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "moves_game_id_ply_key" ON "moves"("game_id", "ply");

-- CreateIndex
CREATE INDEX "move_annotations_move_id_idx" ON "move_annotations"("move_id");

-- CreateIndex
CREATE INDEX "move_annotations_annotation_type_idx" ON "move_annotations"("annotation_type");

-- CreateIndex
CREATE INDEX "scraping_jobs_tournament_id_idx" ON "scraping_jobs"("tournament_id");

-- CreateIndex
CREATE INDEX "scraping_jobs_status_idx" ON "scraping_jobs"("status");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- AddForeignKey
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_players" ADD CONSTRAINT "tournament_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_white_player_id_fkey" FOREIGN KEY ("white_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairings" ADD CONSTRAINT "pairings_black_player_id_fkey" FOREIGN KEY ("black_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_players" ADD CONSTRAINT "followed_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_pairing_id_fkey" FOREIGN KEY ("pairing_id") REFERENCES "pairings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_white_player_id_fkey" FOREIGN KEY ("white_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_black_player_id_fkey" FOREIGN KEY ("black_player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moves" ADD CONSTRAINT "moves_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "move_annotations" ADD CONSTRAINT "move_annotations_move_id_fkey" FOREIGN KEY ("move_id") REFERENCES "moves"("id") ON DELETE CASCADE ON UPDATE CASCADE;
