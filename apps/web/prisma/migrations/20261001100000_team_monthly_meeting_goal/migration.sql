-- Monthly meeting goal shown on Home. Additive only: nullable, no default, no backfill.
ALTER TABLE "Team" ADD COLUMN "monthlyMeetingGoal" INTEGER;
