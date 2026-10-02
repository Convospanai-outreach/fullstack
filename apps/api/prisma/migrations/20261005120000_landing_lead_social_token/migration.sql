-- Creator funnel signed links (phase 4c). Additive only: one nullable column.
-- "LandingLead" was never created by a tracked migration (production has it from an earlier
-- out-of-band `prisma db push`; see 20260916100000_campaign_landing_icp), so a from-scratch
-- `migrate deploy` (CI, a fresh env) has no such table. Guarded the same way.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LandingLead') THEN
    ALTER TABLE "LandingLead" ADD COLUMN "socialToken" TEXT;
  END IF;
END
$$;
