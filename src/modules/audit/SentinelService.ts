
import { prisma } from "@/lib/db";
import Docker from 'dockerode';
import { HardwareService } from "@/services/HardwareService";

// Interface for the Sentinel's Report
export interface SentinelReport {
    status: "PASS" | "FAIL" | "WARN";
    data_score: number;
    security_score: number; // 0.0 - 1.0 (Higher is safer)
    connection_health: "STABLE" | "DEGRADED" | "OFFLINE";
    logs: string[];
    action_taken: string;
    suggested_actions?: string[]; // e.g. ["ROTATE_PROXY", "INCREASE_JITTER"]
}

export class SentinelService {
    private static docker = new Docker({ socketPath: process.env['DOCKER_SOCK'] || '/var/run/docker.sock' });

    // Moving average state (In-memory for MVP, should be Redis in prod)
    private static latencyHistory: number[] = [];
    private static MAX_HISTORY = 50;

    /**
     * The main entry point for the Sentinel Agent.
     * Evaluates a batch of scraped data and the node's health metrics.
     */
    static async evaluate(payload: any, nodeMetrics: any): Promise<SentinelReport> {
        const report: SentinelReport = {
            status: "PASS",
            data_score: 1.0,
            security_score: 1.0,
            connection_health: "STABLE",
            logs: [],
            action_taken: "NONE",
            suggested_actions: []
        };

        // 1. Connection Health Check (CHC) ("Saturn" Logic)
        await this.validateConnection(nodeMetrics, report);

        // Z-Score Latency Check
        this.updateLatencyHistory(nodeMetrics.latency);
        const zScore = this.calculateZScore(nodeMetrics.latency);
        if (zScore > 3) {
            report.logs.push(`⚠️ Latency Spike Detected (Z-Score: ${zScore.toFixed(2)})`);
            report.data_score -= 0.2;
        }

        if (nodeMetrics.statusCode === 429 || nodeMetrics.statusCode === 403) {
            report.connection_health = "DEGRADED";
            report.logs.push(`⚠️ Node is being rate-limited (Status: ${nodeMetrics.statusCode})`);

            // Auto-Remediation: Reboot if persistent
            if (nodeMetrics.errorCount > 5) {
                report.connection_health = "OFFLINE";
                report.action_taken = "REBOOT_TRIGGERED";
                await this.rebootScraperNode();
            }
        }

        // 2. Data Quality Check (DQC) ("Mercury" Logic)
        // Schema Validation (Zod-like manual check for now, can import Zod if package available)
        const requiredFields = ['title', 'source_url', 'region_id'];
        const missingFields = requiredFields.filter(f => !payload[f]);
        if (missingFields.length > 0) {
            report.status = "FAIL";
            report.logs.push(`🚨 Schema Violation: Missing fields [${missingFields.join(', ')}]`);
            report.data_score = 0.0;
        }

        if (!payload.friction_signal || payload.friction_signal === "Loading..." || payload.friction_signal === "Page not found") {
            report.status = "FAIL";
            report.logs.push("🚨 Zero-Inference: Payload contains generic placeholder text.");
            report.data_score = 0.0;
        }

        // Region Validation
        this.validateRegion(payload, report);

        // Honeypot / Semantic Decay
        if (payload._isHiddenTextDetected) {
            report.status = "FAIL";
            report.logs.push("🚨 HONEYPOT DETECTED: Hidden text field was scraped.");
            report.action_taken = "SESSION_TERMINATED";
        }

        // Semantic Sanity Judge (Harden Factor)
        try {
            const textToJudge = payload.content || payload.friction_signal || "";
            if (textToJudge.length > 30) {
                const verdict = await HardwareService.critique(textToJudge, "Verify if this scraped content is high quality and readable.");
                if (verdict.status === 'REJECTED') {
                    report.status = "FAIL";
                    report.logs.push(`🚨 Semantic Decay: Content failed local LLM sanity judge. Reason: ${verdict.reason}`);
                    report.data_score = 0.0;
                }
            }
        } catch (e) {
            report.logs.push("⚠️ Semantic Judge bypassed: Edge Node unreachable.");
        }

        // 3. Operational Actions & Audit Logging
        if (report.status === "FAIL" || report.data_score < 0.6 || report.security_score < 0.5) {
            // Quarantine in review queue
            await prisma.manualReview.create({
                data: {
                    source: "Sentinel",
                    payload: payload,
                    reason: report.logs.join("; "),
                    severity: report.status === "FAIL" ? "CRITICAL" : "WARN",
                    region: payload.region_id || "GLOBAL",
                    status: "PENDING"
                }
            });
            report.action_taken = report.action_taken === "NONE" ? "QUARANTINED" : report.action_taken;

            // [Persistence] Record a SystemEvent for the dashboard alerting system
            try {
                const { EventStore } = await import("@/lib/events");
                await EventStore.record({
                    type: "SENTINEL",
                    name: "SENTINEL_ALERT",
                    teamId: payload.teamId || "SYSTEM",
                    actorId: "SENTINEL_AGENT",
                    payload: {
                        report,
                        jobId: payload.jobId,
                        region: payload.region_id
                    }
                });
            } catch (e) {
                console.error("[Sentinel] Failed to record SystemEvent alert", e);
            }

            // Log to Audit Trail
            await prisma.auditLog.create({
                data: {
                    action: "SENTINEL_BLOCK",
                    entity: "ScrapingJob",
                    entityId: payload.jobId || "unknown",
                    metadata: report as any,
                    orgId: payload.teamId || "SYSTEM",
                }
            });
        }

        return report;
    }

    private static validateRegion(payload: any, report: SentinelReport) {
        if (!payload.source_url || !payload.region_id) return;

        const url = payload.source_url.toLowerCase();
        const region = payload.region_id;

        // TLD Logic
        if (region === 'UAE' && !url.includes('.ae') && !url.includes('/ae/')) {
            report.logs.push("⚠️ Region Mismatch: Scraped data marked UAE but URL is not .ae");
            report.data_score -= 0.2;
        }

        if (region === 'INDIA' && !url.includes('.in') && !url.includes('/in/')) {
            report.logs.push("⚠️ Region Mismatch: Scraped data marked INDIA but URL is not .in");
            report.data_score -= 0.2;
        }
    }

    private static async validateConnection(metrics: any, report: SentinelReport) {
        // Proxy Rotation Check
        if (metrics.proxy_used === false) {
            report.logs.push("⚠️ Security Warning: Direct connection used (No Proxy).");
            report.status = "WARN";
            report.security_score -= 0.5;
            report.suggested_actions?.push("ROTATE_PROXY", "ENFORCE_RESIDENTIAL_PROXY");
        }

        // User Agent Variance
        if (metrics.user_agent && (metrics.user_agent.includes("HeadlessChrome") || metrics.user_agent.includes("Playwright"))) {
            report.logs.push("⚠️ Bot Detection Risk: Headless User-Agent detected.");
            report.security_score -= 0.3;
            report.suggested_actions?.push("RANDOMIZE_USER_AGENT", "INJECT_HUMAN_JITTER");
        }

        // Latency Anomalies
        if (metrics.latency > 5000) {
            report.logs.push("⚠️ High Latency Detected: Potential bot-mitigation bottleneck.");
            report.suggested_actions?.push("COOLDOWN_SESSION");
        }
    }

    private static async rebootScraperNode() {
        try {
            // Check if we are in a containerized env before calling Docker
            if (process.env.NODE_ENV === 'production' || process.env['DOCKER_SOCK']) {
                const container = this.docker.getContainer('scraper-node');
                await container.restart();
                console.log("[Sentinel] Scraper Node successfully restarted.");

                await prisma.auditLog.create({
                    data: {
                        action: "SYSTEM_REBOOT",
                        entity: "DockerContainer",
                        entityId: "scraper-node",
                        orgId: "SYSTEM",
                        metadata: { reason: "High Error Rate" }
                    }
                });
            } else {
                console.log("[Sentinel - Mock] Scraper Node reboot simulated.");
            }
        } catch (error) {
            console.error("[Sentinel] Failed to restart scraper node:", error);
        }
    }

    // --- Statistical Helpers ---

    private static updateLatencyHistory(latency: number) {
        this.latencyHistory.push(latency);
        if (this.latencyHistory.length > this.MAX_HISTORY) {
            this.latencyHistory.shift();
        }
    }

    private static calculateZScore(value: number): number {
        if (this.latencyHistory.length < 5) return 0; // Need samples

        const mean = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
        const stdDev = Math.sqrt(this.latencyHistory.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / this.latencyHistory.length);

        if (stdDev === 0) return 0;
        return (value - mean) / stdDev;
    }
}
