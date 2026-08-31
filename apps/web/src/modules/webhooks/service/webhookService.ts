import { prisma } from "@/lib/db";
import crypto from "crypto";
import net from "node:net";
import { lookup } from "node:dns/promises";
import { JobQueue } from "@/lib/queue";
import { logger } from "@/lib/logger";

const WEBHOOK_TIMEOUT_MS = 10000;

// Outbound webhook URLs are user-supplied, so a delivery attempt must not be
// usable as a probe against internal infrastructure (SSRF).
const BLOCKED_RANGES = new net.BlockList();
BLOCKED_RANGES.addSubnet("0.0.0.0", 8, "ipv4");
BLOCKED_RANGES.addSubnet("10.0.0.0", 8, "ipv4");
BLOCKED_RANGES.addSubnet("100.64.0.0", 10, "ipv4");
BLOCKED_RANGES.addSubnet("127.0.0.0", 8, "ipv4");
BLOCKED_RANGES.addSubnet("169.254.0.0", 16, "ipv4");
BLOCKED_RANGES.addSubnet("172.16.0.0", 12, "ipv4");
BLOCKED_RANGES.addSubnet("192.168.0.0", 16, "ipv4");
BLOCKED_RANGES.addSubnet("::", 128, "ipv6");
BLOCKED_RANGES.addSubnet("::1", 128, "ipv6");
BLOCKED_RANGES.addSubnet("fc00::", 7, "ipv6");
BLOCKED_RANGES.addSubnet("fe80::", 10, "ipv6");

export async function assertSafeWebhookUrl(rawUrl: string) {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error("Webhook URL is not a valid URL");
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(`Webhook URL protocol ${url.protocol} is not allowed`);
    }

    // A hostname can resolve to a private address, so check resolved IPs rather
    // than the literal hostname.
    const resolved = await lookup(url.hostname, { all: true });
    for (const { address, family } of resolved) {
        if (BLOCKED_RANGES.check(address, family === 6 ? "ipv6" : "ipv4")) {
            throw new Error("Webhook URL resolves to a non-public address");
        }
    }
}

class WebhookService {
    /**
     * Entry point to trigger webhooks for a team
     */
    async dispatch(teamId: string, event: string, payload: Record<string, any>) {
        try {
            const webhooks = await prisma.webhook.findMany({
                where: {
                    teamId,
                    isActive: true,
                    events: { has: event }
                }
            });

            for (const webhook of webhooks) {
                // Enqueue a job for each webhook to handle retries and async processing
                await JobQueue.enqueue("WEBHOOK_DISPATCH", {
                    webhookId: webhook.id,
                    event,
                    payload
                }, { teamId });
            }
        } catch (error) {
            logger.error(`[WebhookService] Dispatch failed for team ${teamId}`, { error, event });
        }
    }

    /**
     * Actual delivery logic (called by worker)
     */
    async processDelivery(webhookId: string, event: string, payload: Record<string, any>) {
        const webhook = await prisma.webhook.findUnique({
            where: { id: webhookId }
        });

        if (!webhook || !webhook.isActive) return;

        const body = JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            data: payload
        });

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-CraftMyFunnel-Event": event,
        };

        // Add Signature if secret exists
        if (webhook.secret) {
            const signature = crypto
                .createHmac("sha256", webhook.secret)
                .update(body)
                .digest("hex");
            headers["X-CraftMyFunnel-Signature"] = signature;
        }

        const startTime = Date.now();
        let status = 0;
        let responseContent = null;
        let errorMessage = null;

        try {
            await assertSafeWebhookUrl(webhook.url);

            logger.info(`[WebhookService] Delivering webhook ${webhookId} to ${webhook.url}`, { event });
            const response = await fetch(webhook.url, {
                method: "POST",
                headers,
                body,
                signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS)
            });

            status = response.status;
            responseContent = await response.text();

            if (!response.ok) {
                throw new Error(`Target returned ${status}`);
            }
            logger.info(`[WebhookService] Successfully delivered webhook ${webhookId}`, { status, duration: Date.now() - startTime });
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : "Unknown error";
            logger.error(`[WebhookService] Delivery failed for webhook ${webhookId}`, { error: errorMessage, url: webhook.url });
            throw error; // Re-throw for JobQueue to handle retries
        } finally {
            const duration = Date.now() - startTime;

            // Log delivery attempt
            await prisma.webhookLog.create({
                data: {
                    webhookId,
                    event,
                    status,
                    payload,
                    ...(responseContent ? { response: { content: responseContent.substring(0, 1000) } } : {}),
                    error: errorMessage,
                    duration
                }
            });
        }
    }
}

export const webhookService = new WebhookService();
