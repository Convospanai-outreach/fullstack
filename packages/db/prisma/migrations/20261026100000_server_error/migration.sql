-- A 500 a route handler answered with a fixed message: the caught error's details, for superadmins.
CREATE TABLE "ServerError" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT,
    "message" VARCHAR(1000) NOT NULL,
    "stack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerError_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServerError_createdAt_idx" ON "ServerError"("createdAt");
