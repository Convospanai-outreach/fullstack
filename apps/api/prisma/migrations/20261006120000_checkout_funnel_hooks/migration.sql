-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "automationsActivatedAt" TIMESTAMP(3),
ADD COLUMN     "automationsActivatedById" TEXT,
ADD COLUMN     "automationsActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cartAbandonHours" INTEGER,
ADD COLUMN     "cartAbandonSequenceId" TEXT,
ADD COLUMN     "deliveryMailboxId" TEXT,
ADD COLUMN     "deliveryUrl" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "abandonHandledAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryError" TEXT,
ADD COLUMN     "deliveryStatus" TEXT,
ADD COLUMN     "leadId" TEXT;

-- CreateIndex
CREATE INDEX "Order_leadId_idx" ON "Order"("leadId");

-- CreateIndex
CREATE INDEX "Order_status_abandonHandledAt_idx" ON "Order"("status", "abandonHandledAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

