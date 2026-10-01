-- AlterTable (additive, nullable: safe for migrate deploy on a live table)
ALTER TABLE "User" ADD COLUMN     "company" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profileCompletedAt" TIMESTAMP(3);
