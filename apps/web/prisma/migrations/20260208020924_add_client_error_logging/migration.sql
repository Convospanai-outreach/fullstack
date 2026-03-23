-- CreateTable
CREATE TABLE "ClientError" (
    "id" TEXT NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "stack" TEXT,
    "componentStack" TEXT,
    "url" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "userId" TEXT,
    "ip" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientError_createdAt_idx" ON "ClientError"("createdAt");

-- CreateIndex
CREATE INDEX "ClientError_userId_idx" ON "ClientError"("userId");

-- CreateIndex
CREATE INDEX "ClientError_url_idx" ON "ClientError"("url");
