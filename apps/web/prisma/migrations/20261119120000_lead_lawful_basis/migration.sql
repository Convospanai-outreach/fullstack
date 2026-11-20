-- DPDP lawful basis per lead. Additive only: a new enum and three new Lead columns with safe defaults.
-- No backfill: existing leads read as NONE until someone records consent or a public source.
DO $$ BEGIN
  CREATE TYPE "LawfulBasis" AS ENUM ('CONSENT', 'PUBLIC_SOURCE', 'NONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lawfulBasis" "LawfulBasis" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "publishedBySubject" BOOLEAN NOT NULL DEFAULT false;
