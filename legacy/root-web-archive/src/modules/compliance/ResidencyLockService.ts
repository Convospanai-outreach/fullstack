
import { Region } from "@prisma/client";
import { DbFactory } from "@/lib/dbFactory";

export class ResidencyLockService {
    /**
     * Detects the required region based on request headers or metadata.
     */
    static getRegionFromContext(headers: Headers | Record<string, string>): Region {
        const getHeader = (name: string) => {
            if (headers instanceof Headers) return headers.get(name);
            return headers[name] || headers[name.toLowerCase()];
        };

        const regionStr = getHeader("X-Region-ID") || getHeader("x-region-id");
        
        if (regionStr === "UAE") return Region.UAE;
        if (regionStr === "EU") return Region.EU;
        
        return Region.GLOBAL;
    }

    /**
     * Enforces that a lead or entity is only accessed via the correct regional client.
     */
    static async validateResidency(entityId: string, expectedRegion: Region): Promise<void> {
        const client = DbFactory.getClient(expectedRegion);
        
        // Try to find the entity in the regional DB
        // This is a simplified check. In prod, we'd use a global index or 
        // rely on the routing layer to ensure we never even hit the wrong region.
        const exists = await (client as any).lead.findUnique({
            where: { id: entityId },
            select: { id: true }
        });

        if (!exists && expectedRegion !== Region.GLOBAL) {
            // Check if it exists in GLOBAL (illegal cross-region access attempt)
            const globalClient = DbFactory.getClient(Region.GLOBAL);
            const inGlobal = await (globalClient as any).lead.findUnique({
                where: { id: entityId },
                select: { id: true }
            });

            if (inGlobal) {
                throw new Error(`Data Residency Violation: Entity ${entityId} is stored in GLOBAL but requested via ${expectedRegion} lock.`);
            }
        }
    }

    /**
     * Returns the strict connection string or client for a region.
     */
    static getRegionalClient(region: Region) {
        return DbFactory.getClient(region);
    }
}
