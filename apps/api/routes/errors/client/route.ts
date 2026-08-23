import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ClientErrorAlertService } from "@/lib/errors/ClientErrorAlertService";
import { logger } from "@/lib/logger";

// Rate limiting: Track error reports per IP
const errorRateLimit = new Map<string, { count: number; resetAt: number }>();
const MAX_ERRORS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

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
            userId,
            metadata
        } = body;

        // Validate required fields
        if (!message) {
            return NextResponse.json(
                { error: "Error message is required" },
                { status: 400 }
            );
        }

        // Store error in database
        const errorLog = await prisma.clientError.create({
            data: {
                message: message.substring(0, 500), // Limit message length
                stack: stack ? stack.substring(0, 2000) : null,
                componentStack: componentStack ? componentStack.substring(0, 2000) : null,
                url: url || req.headers.get("referer") || "unknown",
                userAgent: userAgent || req.headers.get("user-agent") || "unknown",
                userId: userId || null,
                ip,
                metadata: metadata || {}
            }
        });

        logger.info("[ClientError] Logged client error", { errorLogId: errorLog.id, message });

        // Trigger async error monitoring and alerting
        // Don't await - run in background
        ClientErrorAlertService.monitorAndAlert(5).catch(err => {
            console.error("[ClientError] Alert monitoring failed:", err);
        });

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
