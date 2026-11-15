-- An application sent through a careers page. The resume is kept with it.
CREATE TYPE "JobApplicationStatus" AS ENUM ('NEW', 'REVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED');

CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobSlug" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "coverNote" TEXT,
    "resumeName" TEXT NOT NULL,
    "resumeType" TEXT NOT NULL,
    "resumeSize" INTEGER NOT NULL,
    "resumeData" BYTEA NOT NULL,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JobApplication_createdAt_idx" ON "JobApplication"("createdAt");
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");
