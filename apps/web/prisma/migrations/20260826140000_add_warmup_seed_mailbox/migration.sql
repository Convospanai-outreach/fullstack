-- CreateTable
CREATE TABLE "WarmupSeedMailbox" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT 'Alex',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "user" TEXT NOT NULL,
    "encryptedPassword" JSONB NOT NULL,
    "dailyCapacity" INTEGER NOT NULL DEFAULT 20,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "sentTodayDate" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarmupSeedMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarmupSeedMailbox_email_key" ON "WarmupSeedMailbox"("email");

-- CreateIndex
CREATE INDEX "WarmupSeedMailbox_status_idx" ON "WarmupSeedMailbox"("status");
