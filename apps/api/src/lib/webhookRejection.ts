import { logger } from "@/lib/logger";

export type WebhookRejectionReason = "missing_signature" | "invalid_signature" | "invalid_verify_token";

/**
 * Records a webhook rejected for its signature, so a probing or misconfigured sender shows up in
 * the logs. Logs where it came from and how big it was, never the body, query string or headers.
 */
export function logWebhookRejected(req: Request, provider: string, reason: WebhookRejectionReason, bodyLength?: number) {
    let pathname = "";
    try {
        pathname = new URL(req.url).pathname;
    } catch {
        // A malformed URL is not worth failing the rejection over.
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    logger.warn("webhook.signature_invalid", { provider, reason, path: pathname, ip, bodyLength });
}
