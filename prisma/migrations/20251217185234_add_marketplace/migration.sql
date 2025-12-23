-- CreateTable
CREATE TABLE "MarketplaceTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "config" JSONB NOT NULL,
    "metrics" JSONB,
    "isOfficial" BOOLEAN NOT NULL DEFAULT true,
    "author" TEXT NOT NULL DEFAULT 'ConvoSpan',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceTemplate_type_idx" ON "MarketplaceTemplate"("type");

-- CreateIndex
CREATE INDEX "MarketplaceTemplate_category_idx" ON "MarketplaceTemplate"("category");
