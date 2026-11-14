-- Enable row level security on the 39 public tables that were created without it.
--
-- Supabase exposes the public schema through its Data API, and the anon and
-- authenticated roles hold table grants there. With RLS off, anyone holding the
-- project's anon key could read and insert rows in these tables (they include
-- SuperAdminCredential, the MCP OAuth tables, SocialAccount and LandingLead).
--
-- No policies are added, on purpose: with RLS on and no policy, anon and
-- authenticated see nothing. The application is unaffected because it connects as
-- the table owner (postgres), which is not subject to RLS -- the same arrangement
-- the other 116 tables already use.
--
-- Non-destructive and safe to re-run: no data or grants change.

ALTER TABLE "public"."AiDraftBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AiDraftBatchItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CampaignAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ContentPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ContentPostTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DigestLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DmFlow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DmFlowEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."DmFlowRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Enquiry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FacebookLeadSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FacebookLeadSyncCursor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."JobApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."KeywordTrigger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."KeywordTriggerReply" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LandingAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LandingCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LandingEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LandingExperiment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LandingExperimentVariant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LandingLead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LandingPage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LandingWireframeOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeadDataSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."LeadProperty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."McpOAuthClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."McpOAuthCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."McpOAuthGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."McpOAuthRefreshUse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."McpRelayClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."McpToolAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PlaybookRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServerError" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ServiceHeartbeat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SiteBanner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SocialAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SocialContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SuperAdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SuperAdminCredential" ENABLE ROW LEVEL SECURITY;
