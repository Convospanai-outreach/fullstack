-- Distinguishes which sending provider a DomainAuthenticationCheck's records
-- belong to (Google Workspace's required MX/SPF differ from Resend's), and
-- stores the provider's own domain id so a re-check doesn't need to
-- re-register the domain with that provider every time.
ALTER TABLE "DomainAuthenticationCheck" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'GOOGLE_WORKSPACE';
ALTER TABLE "DomainAuthenticationCheck" ADD COLUMN "providerDomainId" TEXT;

DROP INDEX "DomainAuthenticationCheck_team_domain_key";
CREATE UNIQUE INDEX "DomainAuthenticationCheck_team_domain_provider_key" ON "DomainAuthenticationCheck"("teamId", "domain", "provider");
