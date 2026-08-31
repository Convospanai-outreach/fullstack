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
            // Scoped to teamId - without this, a lead belonging to a different team could
            // be pushed into and mutated by this team's own HubSpot integration (cross-tenant
            // PII leak), since callers (including LLM agent tool calls) pass a caller-chosen
            // leadId that isn't otherwise guaranteed to belong to teamId.
            const [lead, config] = await Promise.all([
                prisma.lead.findFirst({ where: { id: leadId, teamId } }),
                prisma.crmIntegration.findUnique({ where: { teamId_provider: { teamId, provider: "HUBSPOT" } } })
            ]);

            if (!lead) return { status: "error", details: "Lead not found" };
            if (!lead.email) return { status: "failed", details: "Lead email is required for sync" };
            if (!config || !config.isActive || !config.accessToken) {
                return { status: "failed", details: "HubSpot not configured or inactive" };
            }

            let accessToken = config.accessToken;

            // Refresh token if expired
            if (config.refreshToken && config.expiresAt && config.expiresAt < new Date()) {
                const clientId = process.env["HUBSPOT_CLIENT_ID"];
                const clientSecret = process.env["HUBSPOT_CLIENT_SECRET"];
                if (!clientId || !clientSecret) {
                    throw new Error("HubSpot OAuth credentials are not configured");
                }

                logger.info(`[CRM Service] Refreshing HubSpot token for team ${teamId}`);
                const params = new URLSearchParams();
                params.set("grant_type", "refresh_token");
                params.set("refresh_token", config.refreshToken);
                params.set("client_id", clientId);
                params.set("client_secret", clientSecret);

                const tokenRes = await fetch("https://api.hubapi.com/oauth/v1/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: params.toString()
                });

                if (!tokenRes.ok) {
                    const errorText = await tokenRes.text();
                    throw new Error(`HubSpot token refresh failed: ${errorText}`);
                }

                const tokenJson: any = await tokenRes.json();
                const nextAccessToken = tokenJson.access_token as string | undefined;
                const nextRefreshToken = tokenJson.refresh_token as string | undefined;
                const expiresIn = tokenJson.expires_in as number | undefined;

                if (!nextAccessToken || !expiresIn) {
                    throw new Error("HubSpot token refresh returned invalid payload");
                }

                const nextExpiry = new Date(Date.now() + expiresIn * 1000);
                await prisma.crmIntegration.update({
                    where: { teamId_provider: { teamId, provider: "HUBSPOT" } },
                    data: {
                        accessToken: nextAccessToken,
                        refreshToken: nextRefreshToken || config.refreshToken,
                        expiresAt: nextExpiry
                    }
                });

                accessToken = nextAccessToken;
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
