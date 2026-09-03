import { prisma } from "@/lib/db";
import { createCustomHostname } from "./cloudflareCustomHostnameService";

export interface BrandingConfig {
    logoUrl?: string;
    primaryColor?: string;
    portalTitle?: string;
    faviconUrl?: string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
    primaryColor: "#3B82F6", // Default Blue
    portalTitle: "CraftMyFunnel AI",
};

export class BrandingService {

    /**
     * Resolves branding configuration based on the incoming hostname.
     * Looks for a CustomDomain match, then fetches team branding.
     */
    static async getBranding(host: string): Promise<BrandingConfig> {
        // Simple optimization: Ignore localhost and main domain to save DB calls
        // In production, we'd cache this heavily
        if (host.includes("localhost") || host === "craftmyfunnel.com") {
            return DEFAULT_BRANDING;
        }

        try {
            const domainRecord = await prisma.customDomain.findUnique({
                where: { domain: host },
                include: { team: { select: { branding: true } } }
            });

            if (domainRecord && domainRecord.team?.branding) {
                return {
                    ...DEFAULT_BRANDING,
                    ...(domainRecord.team.branding as BrandingConfig)
                };
            }
        } catch (error) {
            console.error("Error resolving branding:", error);
        }

        return DEFAULT_BRANDING;
    }

    static async updateBranding(teamId: string, branding: BrandingConfig) {
        return prisma.team.update({
            where: { id: teamId },
            data: { branding: branding as any }
        });
    }

    static async addDomain(teamId: string, domain: string) {
        // Real ownership verification via Cloudflare for SaaS (Custom Hostnames) -
        // see cloudflareCustomHostnameService.ts. Status polling happens exclusively
        // in apps/api's worker-manager tick (this deployment has no long-running
        // process to poll from); if Cloudflare isn't configured here, the row is
        // still created as "pending" so the flow keeps working.
        const cloudflareResult = await createCustomHostname(domain).catch((error) => {
            console.error(`[BrandingService] Cloudflare custom hostname creation failed for ${domain}:`, error);
            return null;
        });

        return prisma.customDomain.create({
            data: {
                teamId,
                domain,
                status: "pending",
                cloudflareHostnameId: cloudflareResult?.cloudflareHostnameId ?? null,
                ownershipVerificationName: cloudflareResult?.ownershipVerification?.name ?? null,
                ownershipVerificationValue: cloudflareResult?.ownershipVerification?.value ?? null,
            }
        });
    }
}
