-- Creator funnel publisher (phase 3b). Additive only: two nullable columns.
ALTER TABLE "ContentPost" ADD COLUMN "publishLeaseUntil" TIMESTAMP(3);
ALTER TABLE "ContentPostTarget" ADD COLUMN "containerId" TEXT;
