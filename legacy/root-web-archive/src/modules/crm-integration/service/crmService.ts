import { Client } from "@hubspot/api-client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface SyncResult {
    status: "success" | "exists" | "failed" | "error";
    crmId?: string;
    details?: string;
}

class CRMService {
    /**
     * Syncs a lead to the configured CRM for a specific team.
     */
    async syncLead(leadId: string, teamId: string): Promise<SyncResult> {
        try {
            const [lead, config] = await Promise.all([
                prisma.lead.findUnique({ where: { id: leadId } }),
                prisma.crmIntegration.findUnique({ where: { teamId_provider: { teamId, provider: "HUBSPOT" } } })
            ]);

            if (!lead) return { status: "error", details: "Lead not found" };
            if (!lead.email) return { status: "failed", details: "Lead email is required for sync" };
            if (!config || !config.isActive || !config.accessToken) {
                return { status: "failed", details: "HubSpot not configured or inactive" };
            }

            let accessToken = config.accessToken;

            // Token refresh logic mockup
            if (config.refreshToken && config.expiresAt && config.expiresAt < new Date()) {
                logger.info(`[CRM Service] Refreshing HubSpot token for team ${teamId}`);
                // In actual implementation, call HubSpot OAuth API here
                // For now, we log it. Real implementation would update config.accessToken/expiresAt
            }

            const hubspotClient = new Client({ accessToken });

            // 1. Prepare properties using dynamic field mapping
            const defaultMapping = {
                fullName: "firstname",
                email: "email",
                company: "company",
                jobTitle: "jobtitle"
            };

            const mapping = (config.fieldMapping as Record<string, string>) || defaultMapping;
            const properties: Record<string, string> = {};

            // Map standard fields
            if (lead.email) properties[mapping['email'] || "email"] = lead.email;
            if (lead.company) properties[mapping['company'] || "company"] = lead.company;
            if (lead.jobTitle) properties[mapping['jobTitle'] || "jobtitle"] = lead.jobTitle;

            // Handle Full Name splitting for HubSpot's firstname/lastname if mapped to a single field
            if (lead.fullName) {
                const [first, ...last] = lead.fullName.split(" ");
                if (mapping['fullName'] === "firstname") {
                    properties["firstname"] = first || "";
                    properties["lastname"] = last.join(" ");
                } else if (mapping['fullName']) {
                    properties[mapping['fullName']] = lead.fullName;
                }
            }

            // 2. Search for existing contact by email
            const searchRequest = {
                filterGroups: [{
                    filters: [{ propertyName: 'email', operator: 'EQ' as any, value: lead.email }]
                }],
                limit: 1,
                properties: ['email'],
                after: "0",
                sorts: [] as string[]
            };

            const searchResult = await hubspotClient.crm.contacts.searchApi.doSearch(searchRequest);

            let crmId: string;

            if (searchResult.results && searchResult.results.length > 0) {
                // Update existing
                const firstResult = searchResult.results[0]!;
                crmId = firstResult.id;
                await hubspotClient.crm.contacts.basicApi.update(crmId, { properties });

                await prisma.lead.update({
                    where: { id: leadId },
                    data: { crmId, crmSyncedAt: new Date() }
                });

                return { status: "exists", crmId };
            } else {
                // Create new
                const createResponse = await hubspotClient.crm.contacts.basicApi.create({ properties });
                crmId = createResponse.id;

                await prisma.lead.update({
                    where: { id: leadId },
                    data: { crmId, crmSyncedAt: new Date() }
                });

                return { status: "success", crmId };
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            logger.error(`[CRM Service] syncLead error for team ${teamId}:`, { error: errorMessage });
            return { status: "error", details: errorMessage };
        }
    }
}

export const crmService = new CRMService();
