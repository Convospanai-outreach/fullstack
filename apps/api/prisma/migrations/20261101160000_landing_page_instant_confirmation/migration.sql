-- Phase 9: optional instant confirmation for a landing page (null = off). See landing-agent/instantConfirmation.ts.
ALTER TABLE IF EXISTS "LandingPage" ADD COLUMN IF NOT EXISTS "instantConfirmation" JSONB;
