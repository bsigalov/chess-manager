-- CreateTable
CREATE TABLE "round_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tournament_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "round" INTEGER NOT NULL,
    "points_after" DOUBLE PRECISION NOT NULL,
    "rank_after" INTEGER NOT NULL,
    "performance_after" INTEGER,

    CONSTRAINT "round_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "round_snapshots_tournament_id_round_idx" ON "round_snapshots"("tournament_id", "round");

-- CreateIndex
CREATE UNIQUE INDEX "round_snapshots_tournament_id_player_id_round_key" ON "round_snapshots"("tournament_id", "player_id", "round");

-- AddForeignKey
ALTER TABLE "round_snapshots" ADD CONSTRAINT "round_snapshots_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
