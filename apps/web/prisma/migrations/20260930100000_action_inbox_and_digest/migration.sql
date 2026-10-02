-- Action Inbox + daily digest. Additive only.

-- Per-user opt-out for the daily digest email (still gated by emailGlobal).
ALTER TABLE "NotificationSettings" ADD COLUMN "digestEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Outcome a rep marked on a lead's reply in the Action Inbox.
ALTER TABLE "Lead" ADD COLUMN "replyOutcome" TEXT;

-- CreateTable
CREATE TABLE "DigestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sentOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DigestLog_userId_sentOn_key" ON "DigestLog"("userId", "sentOn");

-- AddForeignKey
ALTER TABLE "DigestLog" ADD CONSTRAINT "DigestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
