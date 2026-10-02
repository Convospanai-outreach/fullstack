-- Optional per-user Slack webhook for hot-reply alerts (encrypted JSON). Additive only: nullable, no default, no backfill.
ALTER TABLE "NotificationSettings" ADD COLUMN "slackWebhook" JSONB;
