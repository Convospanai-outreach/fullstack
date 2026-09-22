-- Per-team hidden-feature enablement (roadmap.md U-05). Additive + nullable, so
-- it is safe against the currently-deployed code, which never selects the column.
-- null = team never customized -> readiness-gated defaults computed at read time.
-- Backfill (same migration, so one workflow run suffices and no team is ever left
-- NULL then readiness-gated): existing teams keep the previous always-on set.
ALTER TABLE "Team" ADD COLUMN "enabledFeatures" JSONB;

UPDATE "Team" SET "enabledFeatures" =
  '["linkedin-runner","knowledge","caller","whatsapp","csv-ingestion","hunter-email-finder","workflows","playbooks","marketplace","crystal-knows"]'::jsonb
  WHERE "enabledFeatures" IS NULL;
