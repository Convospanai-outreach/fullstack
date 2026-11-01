-- Which prompt versions and copy settings wrote this email (null = not AI-written or before this column). See email-campaigner/service/copyProvenance.ts.
ALTER TABLE IF EXISTS "Email" ADD COLUMN IF NOT EXISTS "copyProvenance" JSONB;
