-- CreateTable
CREATE TABLE "ExtensionStateItem" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "item" TEXT NOT NULL DEFAULT '',
    "value" JSONB,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionStateItem_pkey" PRIMARY KEY ("userId","key","item")
);

-- CreateTable
CREATE TABLE "ExtensionEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "detail" TEXT,
    "data" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtensionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtensionBrainCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtensionBrainCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtensionEvent_userId_occurredAt_idx" ON "ExtensionEvent"("userId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionEvent_userId_eventId_key" ON "ExtensionEvent"("userId", "eventId");

-- CreateIndex
CREATE INDEX "ExtensionBrainCall_userId_createdAt_idx" ON "ExtensionBrainCall"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExtensionBrainCall_userId_op_idempotencyKey_key" ON "ExtensionBrainCall"("userId", "op", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "ExtensionStateItem" ADD CONSTRAINT "ExtensionStateItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtensionEvent" ADD CONSTRAINT "ExtensionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtensionBrainCall" ADD CONSTRAINT "ExtensionBrainCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

