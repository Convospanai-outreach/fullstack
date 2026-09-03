import { NextResponse } from "next/server";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";
import { intentScoringService } from "@/services/IntentScoring";
import { v4 as uuidv4 } from "uuid";
import { SentinelService } from "@/modules/audit/SentinelService";
import { DbFactory } from "@/lib/dbFactory";
import * as cryptoNode from "crypto";

export async function POST(req: Request) {
    try {
        const bodyText = await req.text();
        const body = JSON.parse(bodyText);

        // 1. Security Check
        const secret = req.headers.get("X-Scraper-Secret");
        const timestamp = req.headers.get("X-Timestamp");
        const complianceHash = req.headers.get("X-Compliance-Hash");

        const hmacSecret = process.env['SCRAPER_SECRET'] || "";
        if (!hmacSecret && process.env['NODE_ENV'] === 'production') {
            throw new Error("CRITICAL: SCRAPER_SECRET is not configured. Webhook cannot verify signatures.");
        }
        const effectiveSecret = hmacSecret || "dev-secret-key-32-chars-long-####"; // Allow fallback ONLY in local dev if explicitly empty

        if (!timestamp || !complianceHash) {
            return NextResponse.json({ error: "Unauthorized: Missing security headers" }, { status: 401 });
        }

        // Prevent Replay (allow 5 minute window)
        const requestTime = parseInt(timestamp, 10);
        if (isNaN(requestTime) || Math.abs(Date.now() - requestTime) > 5 * 60 * 1000) {
            return NextResponse.json({ error: "Unauthorized: Timestamp limit exceeded" }, { status: 401 });
        }

        // Fix [HIGH-3]: Real HMAC Validation
        const expectedHash = cryptoNode
            .createHmac("sha256", effectiveSecret)
            .update(`${bodyText}.${timestamp}`)
            .digest("hex");

        const providedHashBuffer = Buffer.from(complianceHash, "hex");
        const expectedHashBuffer = Buffer.from(expectedHash, "hex");
        if (
            providedHashBuffer.length !== expectedHashBuffer.length ||
            !cryptoNode.timingSafeEqual(providedHashBuffer, expectedHashBuffer)
        ) {
            // Log attempt for audit
            console.error(`[Security] HMAC Mismatch for scraper webhook. Expected prefix: ${expectedHash.substring(0, 8)}`);
            return NextResponse.json({ error: "Unauthorized: Invalid Compliance Hash" }, { status: 401 });
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
            return NextResponse.json({ ok: false, error: "Sentinel Validation Failed", report: sentinelReport }, { status: 400 });
        }

        if (sentinelReport.action_taken === "QUARANTINED") {
            return NextResponse.json({ ok: true, status: "QUARANTINED", report: sentinelReport });
        }

        // 3. Residency Lock & Sovereign Firewall Masking
        const { ResidencyLockService } = await import("@/modules/compliance/ResidencyLockService");
        // We use headers.get() here as ResidencyLockService expects original headers
        const region = ResidencyLockService.getRegionFromContext(req.headers);
        const firewallRegion: 'UAE' | 'GLOBAL' = (region === 'UAE') ? 'UAE' : 'GLOBAL';
        const { safeContext, tokenMap } = await SovereignFirewall.mask(body, firewallRegion);

        // 4. Database Update (Upsert ScrapingJob)
        const jobId = body.jobId || uuidv4();
        let safePayload;
        try {
            safePayload = JSON.parse(safeContext);
        } catch (e) {
            safePayload = {}; 
        }

        const targetPrisma = DbFactory.getClient(region);

        // jobId/teamId are caller-supplied (this webhook authenticates via one
        // shared SCRAPER_SECRET, not a per-team key) - guard against a caller
        // colliding on an existing jobId that belongs to a different team's job.
        const bodyTeamId: string | undefined = typeof body.teamId === "string" ? body.teamId : undefined;
        const existingJob = await targetPrisma.scrapingJob.findUnique({ where: { id: jobId }, select: { teamId: true } });
        if (existingJob && existingJob.teamId && bodyTeamId && existingJob.teamId !== bodyTeamId) {
            return NextResponse.json({ error: "jobId belongs to a different team" }, { status: 409 });
        }

        const job = await targetPrisma.scrapingJob.upsert({
            where: { id: jobId },
            update: {
                status: "COMPLETED",
                payload: safePayload,
                tokenMap: Object.fromEntries(tokenMap),
                updatedAt: new Date(),
                ...(bodyTeamId ? { teamId: bodyTeamId } : {}),
            },
            create: {
                id: jobId,
                url: body.url || body.thread_url || "unknown",
                status: "COMPLETED",
                region: region,
                payload: safePayload,
                tokenMap: Object.fromEntries(tokenMap),
                teamId: bodyTeamId,
            }
        });

        // 5. Action Logic (Intent Scoring)
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
