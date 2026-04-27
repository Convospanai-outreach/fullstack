import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

interface ScrapedProfile {
    url: string;
    name?: string;
    headline?: string;
    about?: string;
    location?: string;
    teamId: string;
    userId: string;
}

const LINKEDIN_HOSTS = new Set(["linkedin.com", "www.linkedin.com"]);

function normalizeLinkedInUrl(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    try {
        const parsed = new URL(value.trim());
        if (parsed.protocol !== "https:") return undefined;
        const hostname = parsed.hostname.toLowerCase();
        if (!LINKEDIN_HOSTS.has(hostname)) return undefined;
        return parsed.toString();
    } catch {
        return undefined;
    }
}

export async function scrapeLinkedInProfile(profile: ScrapedProfile) {
    const linkedInUrl = normalizeLinkedInUrl(profile.url);
    if (!linkedInUrl) {
       throw new Error("Invalid LinkedIn URL");
    }

    try {
        let isNew = false;
        let leadId: string;
        
        const existingLead = await prisma.lead.findFirst({
            where: { linkedIn: linkedInUrl, teamId: profile.teamId }
        });

        const safeAbout = profile.about ? profile.about.slice(0, 4000) : undefined;

        if (existingLead) {
            leadId = existingLead.id;
            const existingEnriched = (!existingLead.enrichedData || typeof existingLead.enrichedData !== "object" || Array.isArray(existingLead.enrichedData)) ? {} : existingLead.enrichedData as Record<string, unknown>;
            const enrichedData = {
                ...existingEnriched,
                ...(safeAbout ? { about: safeAbout } : {}),
                source: "extension_scrape",
                sourceCapturedAt: new Date().toISOString()
            };
            
            await prisma.lead.update({
                where: { id: existingLead.id },
                data: {
                    ...(profile.name ? { fullName: profile.name.slice(0, 200) } : {}),
                    ...(profile.headline ? { jobTitle: profile.headline.slice(0, 200) } : {}),
                    ...(profile.location ? { location: profile.location.slice(0, 140) } : {}),
                    enrichedData
                }
            });
        } else {
            isNew = true;
            const enrichedData = {
                ...(safeAbout ? { about: safeAbout } : {}),
                source: "extension_scrape",
                sourceCapturedAt: new Date().toISOString()
            };
            
            const newLead = await prisma.lead.create({
                data: {
                    fullName: profile.name?.slice(0, 200) || "Unknown",
                    linkedIn: linkedInUrl,
                    ...(profile.headline ? { jobTitle: profile.headline.slice(0, 200) } : {}),
                    ...(profile.location ? { location: profile.location.slice(0, 140) } : {}),
                    status: "NEW",
                    teamId: profile.teamId,
                    enrichedData
                }
            });
            leadId = newLead.id;
        }

        await prisma.systemEvent.create({
            data: {
                teamId: profile.teamId,
                actorId: profile.userId,
                type: "SYSTEM",
                name: "LEAD_SCRAPED_VIA_EXTENSION",
                timestamp: new Date(),
                payload: {
                    leadId,
                    isNew,
                    linkedInUrl
                }
            }
        });

        return { leadId, isNew };

    } catch (e: any) {
        logger.error("Error scraping linkedin profile", e);
        throw e;
    }
}
