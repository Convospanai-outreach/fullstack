-- CreateTable
CREATE TABLE "OverseerSignal" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OverseerSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OverseerSignal_status_idx" ON "OverseerSignal"("status");

-- CreateIndex
CREATE INDEX "OverseerSignal_category_subject_idx" ON "OverseerSignal"("category", "subject");
