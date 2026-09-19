-- Canonical domain field for Lead - a normalized company domain used as the
-- matching key for enrichment (Hunter, CSV import, Netjana) instead of the
-- fragile free-text Lead.company string comparison used previously.
ALTER TABLE "Lead" ADD COLUMN "domain" TEXT;

-- On-demand org-chart self-relation. First self-relation on Lead in this
-- schema - manually drawn reporting lines between leads at the same account,
-- not populated by any ingestion pipeline.
ALTER TABLE "Lead" ADD COLUMN "reportsToId" TEXT;

CREATE INDEX "Lead_domain_idx" ON "Lead"("domain");
CREATE INDEX "Lead_teamId_domain_idx" ON "Lead"("teamId", "domain");
CREATE INDEX "Lead_reportsToId_idx" ON "Lead"("reportsToId");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Per-field provenance for Lead data - which source (Hunter, CSV import,
-- Netjana, manual edit) supplied which field's value, and when. Replaces the
-- prior ad hoc, unaudited convention of nesting provider data inside
-- enrichedData/marketContext JSON with no queryable audit trail.
CREATE TABLE "LeadDataSource" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadDataSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadDataSource_leadId_idx" ON "LeadDataSource"("leadId");
CREATE INDEX "LeadDataSource_leadId_field_idx" ON "LeadDataSource"("leadId", "field");
CREATE INDEX "LeadDataSource_source_idx" ON "LeadDataSource"("source");

ALTER TABLE "LeadDataSource" ADD CONSTRAINT "LeadDataSource_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
