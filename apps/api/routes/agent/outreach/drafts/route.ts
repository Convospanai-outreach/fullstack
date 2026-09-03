import { NextResponse } from "next/server";
import { DbFactory } from "@/lib/dbFactory";
import { getCurrentContext } from "@/lib/auth";

export async function GET() {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch from Global DB - scoped by the caller's own teamId, same as the
        // sibling leads/[id]/identity/route.ts, so this can't leak other teams'
        // scraped-lead drafts.
        const globalClient = DbFactory.getClient('GLOBAL');
        const globalJobs = await globalClient.scrapingJob.findMany({
            where: {
                status: "COMPLETED",
                teamId,
                // In a real app, we might filter by those that haven't been turned into Leads yet
                // or use a specific flag like 'needs_approval'
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        // Fetch from UAE DB if configured
        let uaeJobs: any[] = [];
        if (process.env['UAE_DATABASE_URL']) {
            try {
                const uaeClient = DbFactory.getClient('UAE');
                uaeJobs = await uaeClient.scrapingJob.findMany({
                    where: { status: "COMPLETED", teamId },
                    orderBy: { createdAt: 'desc' },
                    take: 20
                });
            } catch (e) {
                console.warn("Failed to fetch UAE drafts:", e);
            }
        }

        const allJobs = [...globalJobs, ...uaeJobs];

        // Map to UI Draft format
        const drafts = allJobs.map(job => {
            const payload = job.payload as any || {};

            // Heuristic to determine if it's a "Lead" draft
            // The payload structure depends on the scraper.
            // We'll look for common fields or fallback.

            // Check if it's masked
            const isMasked = payload.isMasked || (payload.api_response && payload.api_response.includes("[Masked]"));

            const message = payload.generatedMessage || payload.summary || "";
            const rawScore = typeof payload.score === "number" ? payload.score : undefined;
            const intentScore = typeof payload.intentScore === "number" ? payload.intentScore : undefined;
            const frictionScore = typeof payload.frictionScore === "number" ? payload.frictionScore : undefined;
            const derivedScore = message
                ? Math.min(95, Math.max(50, 50 + Math.floor(message.length / 10)))
                : 60;
            const score = rawScore ?? intentScore ?? frictionScore ?? derivedScore;

            return {
                id: job.id,
                lead: payload.leadName || payload.name || payload.title || "Unknown Lead",
                company: payload.company || payload.organization || "Unknown Company",
                intent: payload.intent || "Detected Signal",
                score,
                message: message || "No draft message generated yet.",
                status: "PENDING_APPROVAL", // UI expects this
                platform: payload.platform || "LINKEDIN",
                isMasked: !!isMasked,
                originalId: job.id, // For identity reveal
                region: job.region
            };
        });

        // Filter out drafts that don't look like leads if necessary
        // For now, return all completed scraping jobs as drafts

        return NextResponse.json(drafts);

    } catch (error: any) {
        console.error("Failed to fetch drafts:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
