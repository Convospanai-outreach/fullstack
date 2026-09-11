-- AlterTable
ALTER TABLE "CustomDomain" ADD COLUMN     "cloudflareHostnameId" TEXT,
ADD COLUMN     "ownershipVerificationName" TEXT,
ADD COLUMN     "ownershipVerificationValue" TEXT,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3);
