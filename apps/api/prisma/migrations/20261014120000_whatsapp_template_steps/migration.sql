-- Creator funnel phase 5c-2: WhatsApp template sends in sequences. Additive only: nullable columns.
-- AlterTable
ALTER TABLE "SequenceStep" ADD COLUMN     "whatsappTemplateLanguage" TEXT,
ADD COLUMN     "whatsappTemplateName" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "whatsappBusinessAccountId" TEXT;

