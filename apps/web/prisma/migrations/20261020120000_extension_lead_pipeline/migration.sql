-- Chrome extension captures queue lead enrichment when this is on (team admins can turn it off).
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "autoEnrichCapturedLeads" BOOLEAN NOT NULL DEFAULT true;

-- Store every LinkedIn profile URL as https://www.linkedin.com/in/<handle>/ with the handle
-- lowercased, the form apps/api/src/lib/crm/linkedin.ts writes, so an extension capture
-- matches the lead imported from a CSV. Values that aren't profile URLs are left alone.
-- Re-running changes nothing.
UPDATE "Lead"
SET "linkedIn" = 'https://www.linkedin.com/in/'
    || lower(substring(btrim("linkedIn") from '(?i)^(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/in/([^/?#[:space:]]+)'))
    || '/'
WHERE substring(btrim("linkedIn") from '(?i)^(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/in/([^/?#[:space:]]+)') IS NOT NULL
  AND "linkedIn" <> 'https://www.linkedin.com/in/'
    || lower(substring(btrim("linkedIn") from '(?i)^(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/in/([^/?#[:space:]]+)'))
    || '/';
