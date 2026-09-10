-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "value" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "wonAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'received';
