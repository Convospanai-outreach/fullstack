
import { prisma } from "@/lib/db";

type ResourceType = "lead" | "campaign";

class BulkService {
    /**
     * Delete multiple resources by ID
     */
    async deleteResources(type: ResourceType, ids: string[]) {
        if (!ids.length) return { count: 0 };

        if (type === "lead") {
            const result = await prisma.lead.deleteMany({
                where: { id: { in: ids } }
            });
            return result;
        } else if (type === "campaign") {
            const result = await prisma.campaign.deleteMany({
                where: { id: { in: ids } }
            });
            return result;
        }

        throw new Error(`Unsupported resource type: ${type}`);
    }

    /**
     * Tag multiple leads.
     */
    async tagResources(type: ResourceType, ids: string[], tags: string[]) {
        if (type !== "lead") throw new Error("Tagging only supported for leads");
        if (!ids.length || !tags.length) return { count: 0 };

        // Postgres specific array update (append)
        // Prisma doesn't support 'push' directly in updateMany easily for arrays in all versions, 
        // but let's try standard updateMany.
        // Actually, appending tags via updateMany is tricky in generic SQL without raw query.
        // Safe bet: Fetch, update, save loop? No, too slow for bulk.
        // Alternative: Use raw query for performance.

        // For now, let's use a loop for safety and correctness, optimizing later if slow.
        // Limitation: 'updateMany' sets the value, doesn't append.

        // Optimization: Use Promise.all
        const updates = ids.map(id =>
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
