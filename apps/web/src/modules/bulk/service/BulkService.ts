
import { prisma } from "@/lib/db";

type ResourceType = "lead" | "campaign";

class BulkService {
    /**
     * Delete multiple resources by ID
     */
    async deleteResources(type: ResourceType, ids: string[], teamId: string) {
        if (!ids.length) return { count: 0 };

        // Scoped by teamId - without this, any caller could delete another team's
        // leads/campaigns by guessing/enumerating IDs (cross-tenant IDOR).
        if (type === "lead") {
            const result = await prisma.lead.deleteMany({
                where: { id: { in: ids }, teamId }
            });
            return result;
        } else if (type === "campaign") {
            const result = await prisma.campaign.deleteMany({
                where: { id: { in: ids }, teamId }
            });
            return result;
        }

        throw new Error(`Unsupported resource type: ${type}`);
    }

    /**
     * Tag multiple leads.
     */
    async tagResources(type: ResourceType, ids: string[], tags: string[], teamId: string) {
        if (type !== "lead") throw new Error("Tagging only supported for leads");
        if (!ids.length || !tags.length) return { count: 0 };

        // Postgres specific array update (append)
        // Prisma's updateMany doesn't support the array 'push' operator (only a
        // single-record update does), so ownership has to be verified up front
        // instead of scoped directly into the mutation's own where clause - without
        // this, any caller could tag another team's leads by guessing/enumerating
        // IDs (cross-tenant IDOR).
        const owned = await prisma.lead.findMany({
            where: { id: { in: ids }, teamId },
            select: { id: true }
        });
        const ownedIds = new Set(owned.map((lead) => lead.id));

        const updates = ids
            .filter((id) => ownedIds.has(id))
            .map((id) =>
                prisma.lead.update({
                    where: { id },
                    data: {
                        tags: {
                            push: tags
                        }
                    }
                })
            );

        const results = await Promise.all(updates);
        return { count: results.length };
    }
}

export const bulkService = new BulkService();
