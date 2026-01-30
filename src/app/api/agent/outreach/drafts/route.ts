import { NextResponse } from "next/server";
import { DbFactory } from "@/lib/dbFactory";
import { Region } from "@prisma/client";

export async function GET() {
    try {
        // Fetch from Global DB
        const globalClient = DbFactory.getClient('GLOBAL');
        const globalJobs = await globalClient.scrapingJob.findMany({
            where: {
                status: "COMPLETED",
                // In a real app, we might filter by those that haven't been turned into Leads yet
                // or use a specific flag like 'needs_approval'
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        // Fetch from UAE DB if configured
        let uaeJobs: any[] = [];
        if (process.env.UAE_DATABASE_URL) {
            try {
                const uaeClient = DbFactory.getClient('UAE');
                uaeJobs = await uaeClient.scrapingJob.findMany({
                    where: { status: "COMPLETED" },
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

            return {
                id: job.id,
                lead: payload.leadName || payload.name || payload.title || "Unknown Lead",
                company: payload.company || payload.organization || "Unknown Company",
                intent: payload.intent || "Detected Signal",
                score: payload.score || Math.floor(Math.random() * 40) + 60, // Mock score if missing
                message: payload.generatedMessage || payload.summary || "No draft message generated yet.",
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
