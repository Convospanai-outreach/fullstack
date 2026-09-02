-- CreateTable
CREATE TABLE "FacebookLeadSource" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT,
    "encryptedPageAccessToken" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookLeadSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacebookLeadSyncCursor" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "lastCreatedTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockExpiresAt" TIMESTAMP(3),
    "lockToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacebookLeadSyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacebookLeadSource_teamId_idx" ON "FacebookLeadSource"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookLeadSource_teamId_pageId_key" ON "FacebookLeadSource"("teamId", "pageId");

-- CreateIndex
CREATE INDEX "FacebookLeadSyncCursor_teamId_idx" ON "FacebookLeadSyncCursor"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "FacebookLeadSyncCursor_sourceId_formId_key" ON "FacebookLeadSyncCursor"("sourceId", "formId");

-- AddForeignKey
ALTER TABLE "FacebookLeadSource" ADD CONSTRAINT "FacebookLeadSource_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookLeadSyncCursor" ADD CONSTRAINT "FacebookLeadSyncCursor_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacebookLeadSyncCursor" ADD CONSTRAINT "FacebookLeadSyncCursor_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "FacebookLeadSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
