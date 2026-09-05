import { DbFactory } from "@/lib/dbFactory";
import { AuditService } from "@/modules/audit/auditService";
import { MarketContext } from "@/lib/middleware/MarketRoutingMiddleware";

export interface UpsertLeadOptions {
    fullName?: string | null;
    email?: string | null;
    linkedIn?: string | null;
    phone?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    location?: string | null;
    status?: string | null;
    pipelineState?: string | null;
    tags?: string[];
    crmId?: string | null;
    value?: number;
    campaignId?: string | null;
    enrichedData?: any;
    marketContext?: MarketContext;
}

export class LeadService {
    /**
     * Upserts a lead into the sharded database context.
     * Ensures consistent validation, duplicate detection, and region routing.
     */
    static async upsert(
        teamId: string,
        userId: string | null,
        data: UpsertLeadOptions
    ) {
        const region = data.marketContext?.region || 'GLOBAL';
        const db = DbFactory.getClient(region);

        if (!data.email && !data.linkedIn) {
            throw new Error("Either Email or LinkedIn URL is required");
        }

        // Check for duplicate within the team
        let existing = null;
        if (data.email) {
            existing = await db.lead.findFirst({
                where: { email: data.email, teamId },
            });
        }
        
        if (!existing && data.linkedIn) {
            existing = await db.lead.findFirst({
                where: { linkedIn: data.linkedIn, teamId },
            });
        }

        if (data.campaignId) {
            const campaign = await db.campaign.findFirst({
                where: { id: data.campaignId, teamId },
                select: { id: true },
            });
            if (!campaign) {
                throw new Error("Invalid campaignId");
            }
        }

        const leadData: any = {
            fullName: data.fullName ?? (existing ? existing.fullName : null),
            email: data.email ?? (existing ? existing.email : null),
            linkedIn: data.linkedIn ?? (existing ? existing.linkedIn : null),
            phone: data.phone ?? (existing ? existing.phone : null),
            company: data.company ?? (existing ? existing.company : null),
            jobTitle: data.jobTitle ?? (existing ? existing.jobTitle : null),
            location: data.location ?? (existing ? existing.location : null),
            status: data.status || (existing ? existing.status : "NEW"),
            pipelineState: data.pipelineState || (existing ? existing.pipelineState : "COLD"),
            tags: data.tags || (existing ? existing.tags : []),
            crmId: data.crmId ?? (existing ? existing.crmId : null),
            value: data.value ?? (existing ? existing.value : 0.0),
            campaignId: data.campaignId ?? (existing ? existing.campaignId : null),
            teamId,
            updatedAt: new Date(),
            regionId: region === 'UAE' ? 'UAE' : 'GLOBAL',
        };

        if (data.marketContext) {
            leadData.marketContext = {
                detectedCountry: data.marketContext.country,
                routedAt: new Date().toISOString()
            };
        }

        if (data.enrichedData) {
            if (existing && existing.enrichedData) {
                leadData.enrichedData = {
                    ...(existing.enrichedData as object),
                    ...data.enrichedData
                };
            } else {
                leadData.enrichedData = data.enrichedData;
            }
        }

        if (existing) {
            const updated = await db.lead.update({
                where: { id: existing.id },
                data: leadData,
            });
            await AuditService.log(teamId, userId, "LEAD_UPDATED", "Lead", updated.id, { email: updated.email, region });
            return updated;
        }

        const created = await db.lead.create({
            data: leadData,
        });
        await AuditService.log(teamId, userId, "LEAD_SYNCED", "Lead", created.id, { email: created.email, region });
        return created;
    }
}
