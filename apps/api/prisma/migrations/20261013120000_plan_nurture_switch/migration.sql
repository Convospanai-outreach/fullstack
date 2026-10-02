-- Creator funnel phase 5c-1b: the launch plan nurture switch and a product's after-purchase sequence.
-- Additive only: nullable columns.
ALTER TABLE "PlaybookRun" ADD COLUMN     "nurtureActivatedAt" TIMESTAMP(3),
ADD COLUMN     "nurtureActivatedById" TEXT;

ALTER TABLE "Product" ADD COLUMN     "postPurchaseSequenceId" TEXT;
