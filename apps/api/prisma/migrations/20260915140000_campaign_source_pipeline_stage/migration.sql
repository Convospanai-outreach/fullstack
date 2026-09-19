-- Labels a campaign that was created via "target leads at a stage" (a recovery
-- campaign for leads dropped at a specific funnel stage). Display-only - not a
-- live/dynamic segment, the leads are still attached at creation time as before.
ALTER TABLE "Campaign" ADD COLUMN "sourcePipelineStage" TEXT;
