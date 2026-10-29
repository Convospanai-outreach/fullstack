-- AI-written outreach waits for approval unless a team opts out; existing teams start with approval on.
ALTER TABLE "OrganizationPolicy" ADD COLUMN "requiresMessageApproval" BOOLEAN NOT NULL DEFAULT true;
