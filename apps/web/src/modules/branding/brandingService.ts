import { prisma } from "@/lib/db";
import { createCustomHostname, removeCustomHostname, setDomainHomePage } from "./cloudflareCustomHostnameService";

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

// Cloudflare env vars aren't set in this environment, so no domain can be connected.
export class CustomDomainsUnavailableError extends Error {
    constructor() {
        super("Custom domains are not configured");
    }
}

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
        // process to poll from). No row is saved unless Cloudflare took the hostname:
        // the poller only advances rows that have a cloudflareHostnameId, so one
        // without it would sit "pending" forever and block the domain for everyone.
        const cloudflareResult = await createCustomHostname(domain);
        if (!cloudflareResult) {
            throw new CustomDomainsUnavailableError();
        }

        return prisma.customDomain.create({
            data: {
                teamId,
                domain,
                status: "pending",
                cloudflareHostnameId: cloudflareResult.cloudflareHostnameId,
                ownershipVerificationName: cloudflareResult.ownershipVerification?.name ?? null,
                ownershipVerificationValue: cloudflareResult.ownershipVerification?.value ?? null,
            }
        });
    }

    /**
     * Picks the page shown at a connected domain's root (null clears it). Returns
     * false when the domain isn't the team's, or the slug isn't one of the team's
     * published pages.
     */
    static async setHomePage(teamId: string, id: string, slug: string | null): Promise<boolean> {
        const record = await prisma.customDomain.findFirst({ where: { id, teamId } });
        if (!record) return false;
        if (slug !== null) {
            const page = await prisma.landingPage.findFirst({ where: { teamId, slug, status: "published" }, select: { id: true } });
            if (!page) return false;
        }

        await setDomainHomePage(record.domain, slug);
        await prisma.customDomain.updateMany({ where: { id, teamId }, data: { homeSlug: slug } });
        return true;
    }

    /** Disconnects one of the team's domains. Returns false when it isn't theirs. */
    static async removeDomain(teamId: string, id: string): Promise<boolean> {
        const record = await prisma.customDomain.findFirst({ where: { id, teamId } });
        if (!record) return false;

        await removeCustomHostname(record.domain, record.cloudflareHostnameId);
        await prisma.customDomain.deleteMany({ where: { id, teamId } });
        return true;
    }
}
