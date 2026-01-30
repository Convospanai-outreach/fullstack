import { NextResponse } from "next/server";
import { DbFactory } from "@/lib/dbFactory";

export async function GET() {
    try {
        const globalDb = DbFactory.getClient('GLOBAL');
        const uaeDb = DbFactory.getClient('UAE');

        // 1. Fetch recent Scraping Jobs from BOTH shards
        // 1. Fetch recent Scraping Jobs from BOTH shards (Filter for high friction)
        const [globalJobs, uaeJobs] = await Promise.all([
            globalDb.scrapingJob.findMany({
                where: {
                    status: "COMPLETED",
                    // Pull high friction or interesting jobs
                },
                take: 6,
                orderBy: { createdAt: 'desc' },
                select: { id: true, url: true, payload: true, createdAt: true, region: true }
            }),
            uaeDb.scrapingJob.findMany({
                where: { status: "COMPLETED" },
                take: 6,
                orderBy: { createdAt: 'desc' },
                select: { id: true, url: true, payload: true, createdAt: true, region: true }
            }).catch(e => {
                console.warn("Failed to fetch UAE stats (might be offline)", e);
                return [];
            })
        ]);

        // 2. Fetch Sentinel Events from AuditLog (Global)
        // Sentinel logs actions like SENTINEL_BLOCK, SYSTEM_REBOOT
        const sentinelEvents = await globalDb.auditLog.findMany({
            where: {
                action: { in: ["SENTINEL_BLOCK", "SYSTEM_REBOOT"] }
            },
            take: 5,
            orderBy: { createdAt: 'desc' }
        });

        const [globalAudits, uaeAudits] = await Promise.all([
            globalDb.manualReview.findMany({
                take: 3,
                orderBy: { createdAt: 'desc' },
                select: { id: true, reason: true, status: true, severity: true, payload: true }
            }),
            uaeDb.manualReview.findMany({
                take: 3,
                orderBy: { createdAt: 'desc' },
                select: { id: true, reason: true, status: true, severity: true, payload: true }
            }).catch(() => [])
        ]);

        // Merge and Sort Jobs
        const allJobs = [...globalJobs, ...uaeJobs]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Transform for UI
        const formattedSignals = allJobs.slice(0, 6).map(job => {
            const p = job.payload as any;
            return {
                id: job.id,
                source: p?.source || (job.region === 'UAE' ? "UAE Node" : "Global Scraper"),
                friction: p?.frictionScore || 0,
                context: p?.content ? p.content.substring(0, 60) + "..." : (job.url?.substring(0, 60) || "No content preview"),
                time: new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
        });

        const formattedAudits = sentinelEvents.map(event => {
            const meta = event.metadata as any;
            return {
                id: event.id,
                score: meta?.data_score ? Math.round(meta.data_score * 10) : 0,
                status: event.action === 'SENTINEL_BLOCK' ? 'REJECTED' : 'SYSTEM_ACTION',
                text: meta?.logs?.[0] || event.action.replace(/_/g, ' '),
            };
        });

        // Fallback to manual review if no audit logs exist yet
        if (formattedAudits.length === 0) {
            const allAudits = [...globalAudits, ...uaeAudits]
                .sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime())
                .slice(0, 3);

            allAudits.forEach(audit => {
                formattedAudits.push({
                    id: audit.id,
                    score: audit.severity === 'CRITICAL' ? 1 : 8,
                    status: audit.severity === 'CRITICAL' ? 'REJECTED' : 'APPROVED',
                    text: audit.reason || "Sentinel Flagged",
                });
            });
        }

        return NextResponse.json({
            ok: true,
            signals: formattedSignals,
            audits: formattedAudits.slice(0, 5),
            lastScan: new Date().toISOString()
        });

    } catch (error: any) {
        console.error("Stats Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
