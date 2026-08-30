-- CreateTable
CREATE TABLE "BreakerState" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'CLOSED',
    "trippedAt" TIMESTAMP(3),
    "resetConditionsMetSince" TIMESTAMP(3),
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics" JSONB,

    CONSTRAINT "BreakerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BreakerState_teamId_key" ON "BreakerState"("teamId");

-- CreateIndex
CREATE INDEX "BreakerState_state_idx" ON "BreakerState"("state");

-- AddForeignKey
ALTER TABLE "BreakerState" ADD CONSTRAINT "BreakerState_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
