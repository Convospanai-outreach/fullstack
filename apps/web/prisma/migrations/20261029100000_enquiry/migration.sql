-- A message sent through a website form, kept so the team can see and follow it up.
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'NOT_INTERESTED');

CREATE TABLE "Enquiry" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Enquiry_ticketId_key" ON "Enquiry"("ticketId");
CREATE INDEX "Enquiry_createdAt_idx" ON "Enquiry"("createdAt");
CREATE INDEX "Enquiry_status_idx" ON "Enquiry"("status");
