-- CreateTable
CREATE TABLE "GuardrailPolicy" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "blocklist" TEXT[],
    "allowlist" TEXT[],
    "maxDailyMsgs" INTEGER NOT NULL DEFAULT 100,
    "detectPII" BOOLEAN NOT NULL DEFAULT true,
    "strictness" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardrailPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardrailLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardrailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuardrailPolicy_teamId_key" ON "GuardrailPolicy"("teamId");

-- CreateIndex
CREATE INDEX "GuardrailLog_teamId_idx" ON "GuardrailLog"("teamId");

-- AddForeignKey
ALTER TABLE "GuardrailPolicy" ADD CONSTRAINT "GuardrailPolicy_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
