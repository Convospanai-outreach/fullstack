import { prisma } from "@/lib/db";
import crypto from "crypto";
import { JobQueue } from "@/lib/queue";
import { logger } from "@/lib/logger";

class WebhookService {
    private readonly WEBHOOK_SCHEMAS: Record<string, (data: any) => object> = {
        'lead.created': (d) => ({
            id: d.id,
            email: d.email,
            fullName: d.fullName,
            company: d.company,
            status: d.status,
            createdAt: d.createdAt
        }),
        'lead.enriched': (d) => ({
            id: d.id,
            email: d.email,
            company: d.company,
            jobTitle: d.jobTitle,
            location: d.location,
            enrichedAt: new Date().toISOString()
        }),
        'campaign.completed': (d) => ({
            id: d.id,
            name: d.name,
            totalLeads: d.leads,
            completedAt: new Date().toISOString()
        }),
        'JOB_DEAD_LETTERED': (d) => ({
            jobId: d.jobId,
            jobType: d.jobType,
            attempts: d.attempts,
            error: d.error
        })
    };

    private filterPayload(event: string, payload: any) {
        const schema = this.WEBHOOK_SCHEMAS[event];
        if (schema) {
            try {
                return schema(payload);
            } catch (e) {
                logger.warn(`[WebhookService] Schema serialization failed for ${event}, using raw payload`, { error: e });
            }
        }
        // For unknown events, we return the payload as-is for now (extensibility)
        return payload;
    }

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

        const filteredPayload = this.filterPayload(event, payload);

        const body = JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            data: filteredPayload
        });

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-ConvoSpan-Event": event,
        };

        // Add Signature if secret exists
        if (webhook.secret) {
            const signature = crypto
                .createHmac("sha256", webhook.secret)
                .update(body)
                .digest("hex");
            headers["X-ConvoSpan-Signature"] = signature;
        }

        const startTime = Date.now();
        let status = 0;
        let responseContent = null;
        let errorMessage = null;

        try {
            logger.info(`[WebhookService] Delivering webhook ${webhookId} to ${webhook.url}`, { event });
            const response = await fetch(webhook.url, {
                method: "POST",
                headers,
                body,
                //@ts-ignore - node-fetch specific
                timeout: 10000
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
