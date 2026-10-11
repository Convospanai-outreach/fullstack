-- A trigger may link to a Mautic landing page instead of (or as well as) a CMf page.
ALTER TABLE "KeywordTrigger" ADD COLUMN IF NOT EXISTS "mauticPageUrl" TEXT;
