import { prisma } from "@/lib/db";
import { vectorStore } from "@/modules/rag/service/vectorStore";

function toRecord(value: unknown) {
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function excerptContent(value: string, maxLength = 420) {
    return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

const API_URL =
    process.env["API_INTERNAL_ORIGIN"]
    || process.env["API_BASE_URL"]
    || process.env["NEXT_PUBLIC_API_URL"]
    || "http://localhost:3001";

export class KnowledgeOrchestrator {
    // NOT FIXED: self-fetches /knowledge/search, which doesn't exist as a route, and has
    // zero callers anywhere in the codebase. Left untouched rather than guessed at.
    static async search(teamId: string, query: string) {
        try {
            const res = await fetch(`${API_URL}/knowledge/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, query })
            });
            return await res.json();
        } catch {
            return [];
        }
    }

    // NOT FIXED: self-fetches /knowledge/ingest, which doesn't exist as a route, and has
    // zero callers anywhere in the codebase. Left untouched rather than guessed at.
    static async ingest(teamId: string, content: string, source: string) {
        try {
            const res = await fetch(`${API_URL}/knowledge/ingest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, content, source })
            });
            return await res.json();
        } catch (error) {
            console.error("Knowledge ingestion proxy failed:", error);
            throw error;
        }
    }

    // Was self-fetching POST /knowledge/campaign-context - a real, live route that runs this
    // exact same lookup - but never forwarded the caller's session, so it always failed auth
    // and silently fell back to "". Replicated that route's Prisma logic directly here.
    //
    // The route derives its team scope from the request session (ctx.teamId), which this
    // method's signature (campaignId, leadId only) doesn't have and emailComposer.ts (the only
    // real caller, outside this fix's scope) doesn't pass through. Derived the team scope from
    // the lead record instead, via leadId. The only live caller always supplies both
    // campaignId and leadId together, so this covers the real usage; if leadId is ever omitted,
    // team scope can't be determined and this returns "" (same as the route's own early-return
    // for the "neither id given" case).
    //
    // Previously hardcoded to only the "Netjana Intelligence" buyer-signal KB (mirrored
    // verbatim from the live route), which meant any other knowledge base a team uploaded
    // (pricing sheets, case studies, product docs) was invisible to email drafting no matter
    // how relevant. Now searches across all of the team's knowledge bases via vectorStore's
    // real embedding similarity - relevance ranking replaces the need for a curated single KB.
    async getCampaignContext(campaignId: string, leadId: string) {
        try {
            if (!leadId) return "";

            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                select: { id: true, company: true, campaignId: true, teamId: true }
            });
            const teamId = lead?.teamId;
            if (!teamId) return "";

            const effectiveCampaignId = campaignId || lead?.campaignId || null;
            const query = [lead?.company, effectiveCampaignId].filter(Boolean).join(" ") || lead?.company || "";
            if (!query) return "";

            const results = await vectorStore.search(query, teamId, 3);

            return results
                .map((item) => {
                    const metadata = toRecord(item.metadata);
                    const companyName = typeof metadata.companyName === "string" ? metadata.companyName : null;
                    const receivedAt = typeof metadata.receivedAt === "string" ? metadata.receivedAt : null;
                    return `- ${companyName || "Buyer signal"}${receivedAt ? ` (${receivedAt})` : ""}: ${excerptContent(item.content)}`;
                })
                .join("\n");
        } catch {
            return "";
        }
    }
}
