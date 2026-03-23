import { NextResponse } from "next/server";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";
import { intentScoringService } from "@/services/IntentScoring";
import { v4 as uuidv4 } from "uuid";
import { SentinelService } from "@/modules/audit/SentinelService";
import { DbFactory } from "@/lib/dbFactory";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // 1. Security Check
        const secret = req.headers.get("X-Scraper-Secret");
        const timestamp = req.headers.get("X-Timestamp");

        const validSecret = process.env['SCRAPER_SECRET'] || "dev-secret";

        if (secret !== validSecret) {
            return NextResponse.json({ error: "Unauthorized: Invalid Secret" }, { status: 401 });
        }

        // Compliance Hash Check (Integrity)
        const complianceHash = req.headers.get("X-Compliance-Hash");
        if (!complianceHash) {
            return NextResponse.json({ error: "Unauthorized: Missing Compliance Hash" }, { status: 401 });
        }

        // In a real system, we'd verify HMAC(body + region + secret). 
        // For MVP, we check presence and could check length/format.
        if (complianceHash.length < 32) {
            return NextResponse.json({ error: "Unauthorized: Invalid Compliance Hash Format" }, { status: 401 });
        }

        if (!timestamp) {
            return NextResponse.json({ error: "Unauthorized: Missing Timestamp" }, { status: 401 });
        }

        // Prevent Replay (allow 5 minute window data might be slightly old)
        const requestTime = parseInt(timestamp, 10);
        if (isNaN(requestTime) || Math.abs(Date.now() - requestTime) > 5 * 60 * 1000) {
            return NextResponse.json({ error: "Unauthorized: Timestamp limit exceeded" }, { status: 401 });
        }

        // 2. Sentinel Audit (Data Quality & Health)
        const metrics = {
            statusCode: 200, 
            latency: parseInt(req.headers.get("X-Scrape-Latency") || "0", 10),
            proxy_used: !!req.headers.get("X-Proxy-IP"),
            user_agent: req.headers.get("User-Agent") || "",
            errorCount: 0
        };

        const sentinelReport = await SentinelService.evaluate(body, metrics);

        if (sentinelReport.status === "FAIL") {
            console.warn("[Webhook] Sentinel Blocked Ingestion:", sentinelReport);
            return NextResponse.json({ ok: false, error: "Sentinel Validation Failed", report: sentinelReport }, { status: 400 });
        }

        if (sentinelReport.action_taken === "QUARANTINED") {
            console.warn("[Webhook] Payload Quarantined by Sentinel:", sentinelReport);
            return NextResponse.json({ ok: true, status: "QUARANTINED", report: sentinelReport });
        }

        // 3. Residency Lock & Sovereign Firewall Masking
        const { ResidencyLockService } = await import("@/modules/compliance/ResidencyLockService");
        const region = ResidencyLockService.getRegionFromContext(req.headers);
        const firewallRegion: 'UAE' | 'GLOBAL' = (region === 'UAE') ? 'UAE' : 'GLOBAL';
        const { safeContext, tokenMap } = await SovereignFirewall.mask(body, firewallRegion);

        // 3. Database Update (Upsert ScrapingJob)
        const jobId = body.jobId || uuidv4();
        let safePayload;
        try {
            safePayload = JSON.parse(safeContext);
        } catch (e) {
            safePayload = {}; 
        }

        // Use DbFactory to respect Data Residency (UAE vs EU vs Global)
        const targetPrisma = DbFactory.getClient(region);

        const job = await targetPrisma.scrapingJob.upsert({
            where: { id: jobId },
            update: {
                status: "COMPLETED",
                payload: safePayload,
                tokenMap: Object.fromEntries(tokenMap), // Save for detokenization
                updatedAt: new Date(),
                // region might not change but we can update it
            },
            create: {
                id: jobId,
                url: body.url || body.thread_url || "unknown",
                status: "COMPLETED",
                region: region,
                payload: safePayload,
                tokenMap: Object.fromEntries(tokenMap), // Save for detokenization
            }
        });

        // 4. Action Logic (Intent Scoring)
        await intentScoringService.processWebhookData(safePayload);

        // [SERVICE-WATCHER] Record Step 2 Signal Heartbeat
        const { serviceWatcher } = await import("@/modules/audit/ServiceWatcher");
        serviceWatcher.recordPulse();

        return NextResponse.json({ ok: true, jobId: job.id });

    } catch (error: any) {
        console.error("[Webhook] Scraper Ingest Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
