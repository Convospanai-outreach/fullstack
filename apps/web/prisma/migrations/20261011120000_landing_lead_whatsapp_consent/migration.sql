-- Creator funnel phase 5b-2: the WhatsApp opt-in checkbox on launch plan pages. Additive only: one
-- nullable column. "LandingLead" was never created by a tracked migration (production has it from an
-- earlier out-of-band `prisma db push`; see 20260916100000_campaign_landing_icp), so a from-scratch
-- `migrate deploy` (CI, a fresh env) has no such table. Guarded the same way as socialToken.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'LandingLead') THEN
    ALTER TABLE "LandingLead" ADD COLUMN IF NOT EXISTS "whatsappConsent" BOOLEAN;
  END IF;
END
$$;
