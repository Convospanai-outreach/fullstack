-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "whatsappPhoneNumberId" TEXT,
ADD COLUMN     "whatsappAccessTokenEnc" JSONB,
ADD COLUMN     "whatsappWabaConfiguredAt" TIMESTAMP(3);
