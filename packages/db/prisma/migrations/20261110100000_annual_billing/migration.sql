-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "yearlyPrice" INTEGER;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billingInterval" TEXT NOT NULL DEFAULT 'MONTH',
ADD COLUMN     "nextCreditGrantAt" TIMESTAMP(3),
ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "renewalReminderFor" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Subscription_billingInterval_nextCreditGrantAt_idx" ON "Subscription"("billingInterval", "nextCreditGrantAt");
