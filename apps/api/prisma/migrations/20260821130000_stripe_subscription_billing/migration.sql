-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
ADD COLUMN     "externalSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "stripePrices" JSONB;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY';

-- CreateIndex
CREATE INDEX "Subscription_gateway_externalSubscriptionId_idx" ON "Subscription"("gateway", "externalSubscriptionId");
