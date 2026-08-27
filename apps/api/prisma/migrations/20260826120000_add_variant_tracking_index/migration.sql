-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "variantId" TEXT;

-- CreateIndex
CREATE INDEX "Email_variantId_idx" ON "Email"("variantId");

-- CreateIndex
CREATE INDEX "TrackedLink_trackingKey_idx" ON "TrackedLink"("trackingKey");

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "CampaignVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
