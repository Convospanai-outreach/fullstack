-- CreateTable
CREATE TABLE "ServiceHeartbeat" (
    "service" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "meta" JSONB,

    CONSTRAINT "ServiceHeartbeat_pkey" PRIMARY KEY ("service")
);
