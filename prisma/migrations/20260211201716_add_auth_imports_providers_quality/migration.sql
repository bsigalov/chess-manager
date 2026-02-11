-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('anonymous', 'viewer', 'player', 'organizer', 'admin');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('pending', 'approved', 'rejected');

-- DropIndex
DROP INDEX "tournaments_is_followed_idx";

-- AlterTable
ALTER TABLE "followed_players" DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "manual_overrides" JSONB;

-- AlterTable
ALTER TABLE "tournaments" DROP COLUMN "is_followed",
ADD COLUMN     "source_type" VARCHAR(30) NOT NULL DEFAULT 'chess-results';

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255),
    "email" VARCHAR(255) NOT NULL,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "password_hash" VARCHAR(255),
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "claimed_player_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" VARCHAR(50),
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" VARCHAR(255) NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "user_tournament_bookmarks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "notifications" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tournament_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "theme" VARCHAR(20) NOT NULL DEFAULT 'system',
    "language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "push_notifications" BOOLEAN NOT NULL DEFAULT false,
    "game_result_alerts" BOOLEAN NOT NULL DEFAULT true,
    "round_start_alerts" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_aliases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "alias" VARCHAR(255) NOT NULL,
    "source" VARCHAR(100) NOT NULL,

    CONSTRAINT "player_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'pending',
    "verification_type" VARCHAR(50) NOT NULL,
    "verification_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "rating_type" VARCHAR(20) NOT NULL,
    "rating" INTEGER NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type" VARCHAR(30) NOT NULL,
    "input_data" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "user_id" UUID,
    "result_data" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "round" INTEGER NOT NULL,
    "standings" JSONB NOT NULL,
    "scraped_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sync_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "sync_type" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "changes_summary" JSONB,
    "duration_ms" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "data_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_claimed_player_id_key" ON "users"("claimed_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "user_tournament_bookmarks_user_id_tournament_id_key" ON "user_tournament_bookmarks"("user_id", "tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "player_aliases_alias_idx" ON "player_aliases"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "player_aliases_player_id_alias_key" ON "player_aliases"("player_id", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "player_claims_user_id_player_id_key" ON "player_claims"("user_id", "player_id");

-- CreateIndex
CREATE INDEX "rating_history_player_id_rating_type_idx" ON "rating_history"("player_id", "rating_type");

-- CreateIndex
CREATE INDEX "import_jobs_status_idx" ON "import_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_snapshots_tournament_id_round_key" ON "tournament_snapshots"("tournament_id", "round");

-- CreateIndex
CREATE INDEX "data_sync_logs_tournament_id_idx" ON "data_sync_logs"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "followed_players_user_id_player_id_key" ON "followed_players"("user_id", "player_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "tournaments_source_type_idx" ON "tournaments"("source_type");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_claimed_player_id_fkey" FOREIGN KEY ("claimed_player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followed_players" ADD CONSTRAINT "followed_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tournament_bookmarks" ADD CONSTRAINT "user_tournament_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tournament_bookmarks" ADD CONSTRAINT "user_tournament_bookmarks_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_aliases" ADD CONSTRAINT "player_aliases_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_claims" ADD CONSTRAINT "player_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_claims" ADD CONSTRAINT "player_claims_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_snapshots" ADD CONSTRAINT "tournament_snapshots_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_sync_logs" ADD CONSTRAINT "data_sync_logs_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

