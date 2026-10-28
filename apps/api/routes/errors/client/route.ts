import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { ClientErrorAlertService } from "@/lib/errors/ClientErrorAlertService";
import { logger } from "@/lib/logger";

// Rate limiting: Track error reports per IP
const errorRateLimit = new Map<string, { count: number; resetAt: number }>();
const MAX_ERRORS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

// Anyone can post here, so every stored field is bounded.
const MAX_FIELD_LENGTH = 500;
const MAX_STACK_LENGTH = 2000;
const MAX_METADATA_BYTES = 4096;

// Each alert pass reads every error of the last few minutes, so one pass a minute is enough.
const MONITOR_INTERVAL_MS = 60000;
let lastMonitorAt = 0;

const text = (value: unknown, max: number): string | null =>
    typeof value === "string" && value ? value.substring(0, max) : null;

function boundedMetadata(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return JSON.stringify(value).length <= MAX_METADATA_BYTES ? (value as Record<string, unknown>) : {};
}

export async function POST(req: NextRequest) {
    try {
        // Get client IP for rate limiting
        const forwarded = req.headers.get("x-forwarded-for");
        const ip = (forwarded?.split(",")[0]?.trim()) || "unknown";

        // Rate limiting
        const now = Date.now();
        const rateLimit = errorRateLimit.get(ip);

        if (rateLimit) {
            if (now < rateLimit.resetAt) {
                if (rateLimit.count >= MAX_ERRORS_PER_MINUTE) {
                    return NextResponse.json(
                        { error: "Too many error reports. Please try again later." },
                        { status: 429 }
                    );
                }
                rateLimit.count++;
            } else {
                // Reset window
                errorRateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
            }
        } else {
            errorRateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        }

        // Parse error details
        const body = await req.json();
        const {
            message,
            stack,
            componentStack,
            url,
            userAgent,
            metadata
        } = body;

        // Validate required fields
        if (typeof message !== "string" || !message) {
            return NextResponse.json(
                { error: "Error message is required" },
                { status: 400 }
            );
        }

        // Anyone can post here, so the reporter's identity comes from the session, never from the body.
        const userId = await getCurrentContext().then((ctx) => ctx.userId ?? null).catch(() => null);

        // Store error in database
        const errorLog = await prisma.clientError.create({
            data: {
                message: message.substring(0, MAX_FIELD_LENGTH),
                stack: text(stack, MAX_STACK_LENGTH),
                componentStack: text(componentStack, MAX_STACK_LENGTH),
                url: text(url, MAX_FIELD_LENGTH) || text(req.headers.get("referer"), MAX_FIELD_LENGTH) || "unknown",
                userAgent: text(userAgent, MAX_FIELD_LENGTH) || text(req.headers.get("user-agent"), MAX_FIELD_LENGTH) || "unknown",
                userId,
                ip,
                metadata: boundedMetadata(metadata)
            }
        });

        logger.info("[ClientError] Logged client error", { errorLogId: errorLog.id, message });

        // Trigger async error monitoring and alerting
        // Don't await - run in background
        if (now - lastMonitorAt >= MONITOR_INTERVAL_MS) {
            lastMonitorAt = now;
            ClientErrorAlertService.monitorAndAlert(5).catch(err => {
                console.error("[ClientError] Alert monitoring failed:", err);
            });
        }

        return NextResponse.json({
            success: true,
            errorId: errorLog.id
        });

    } catch (error: any) {
        console.error("[ClientError] Failed to log error:", error);

        // Don't fail the request even if logging fails
        return NextResponse.json({
            success: false,
            error: "Failed to log error"
        }, { status: 500 });
    }
}

// Cleanup old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, limit] of errorRateLimit.entries()) {
        if (now > limit.resetAt) {
            errorRateLimit.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW);
