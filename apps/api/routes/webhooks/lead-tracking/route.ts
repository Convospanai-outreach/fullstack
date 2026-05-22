import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { leadScoringService } from "@/modules/scoring";
import { z } from "zod";

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getClientKey(req: NextRequest) {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown";
}

function checkTrackingRateLimit(req: NextRequest) {
    const now = Date.now();
    const key = getClientKey(req);
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return { limited: false, resetIn: RATE_LIMIT_WINDOW_MS / 1000 };
    }

    if (record.count >= RATE_LIMIT_MAX) {
        return { limited: true, resetIn: Math.ceil((record.resetAt - now) / 1000) };
    }

    record.count++;
    return { limited: false, resetIn: Math.ceil((record.resetAt - now) / 1000) };
}

const LeadTrackingSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("email_click"),
        leadId: z.string().uuid("Invalid leadId"),
        emailId: z.string().uuid("Invalid emailId").optional(),
    }),
    z.object({
        type: z.literal("dwell"),
        leadId: z.string().uuid("Invalid leadId").optional(),
        email: z.string().email("Invalid email").optional(),
        sessionSeconds: z.number().int().positive("sessionSeconds must be a positive integer").max(60 * 60),
    }),
]);

export async function POST(req: NextRequest) {
    try {
        const rateLimit = checkTrackingRateLimit(req);
        if (rateLimit.limited) {
            return NextResponse.json(
                { error: "Too many tracking events" },
                {
                    status: 429,
                    headers: { "Retry-After": rateLimit.resetIn.toString() }
                }
            );
        }

        const body = await req.json();
        const validation = LeadTrackingSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ 
                error: "Validation failed", 
                details: validation.error.format() 
            }, { status: 400 });
        }

        const data = validation.data;

        if (data.type === "email_click") {
            const { leadId, emailId } = data;

            // 1. Verify lead exists
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead) {
                return NextResponse.json({ error: "Lead not found" }, { status: 404 });
            }

            // 2. Update specific email record if provided
            if (emailId) {
                const emailRecord = await prisma.email.findUnique({ where: { id: emailId } });
                if (emailRecord && emailRecord.leadId === leadId) {
                    await prisma.email.update({
                        where: { id: emailId },
                        data: { clickedAt: new Date() }
                    });
                }
            }

            // 3. Increment email clicks on lead
            await prisma.lead.update({
                where: { id: leadId },
                data: { emailClicks: { increment: 1 } }
            });

            // 4. Re-calculate intent scoring
            const scoringResult = await leadScoringService.scoreAndPersist(leadId);

            return NextResponse.json({
                success: true,
                message: "Email click recorded and scoring updated",
                data: scoringResult
            });
        }

        if (data.type === "dwell") {
            const { leadId, email, sessionSeconds } = data;
            let targetLeadId = leadId;

            // 1. Resolve leadId by email if not directly provided
            if (!targetLeadId && email) {
                const leadRecord = await prisma.lead.findFirst({ where: { email } });
                if (!leadRecord) {
                    return NextResponse.json({ error: "Lead not found for specified email" }, { status: 404 });
                }
                targetLeadId = leadRecord.id;
            }

            if (!targetLeadId) {
                return NextResponse.json({ error: "leadId or email required to resolve target" }, { status: 400 });
            }

            // 2. Verify lead exists
            const lead = await prisma.lead.findUnique({
                where: { id: targetLeadId },
                select: { id: true }
            });

            if (!lead) {
                return NextResponse.json({ error: "Resolved lead not found" }, { status: 404 });
            }

            // 3. Atomic dwell time increment (prevents data loss under concurrency)
            const additionalDwellMinutes = sessionSeconds / 60;
            const updated = await prisma.lead.update({
                where: { id: targetLeadId },
                data: { dwellTimeMinutes: { increment: additionalDwellMinutes } },
                select: { dwellTimeMinutes: true }
            });

            // 4. Re-calculate intent scoring
            const scoringResult = await leadScoringService.scoreAndPersist(targetLeadId);

            return NextResponse.json({
                success: true,
                message: "Website dwell time recorded and scoring updated",
                dwellTimeMinutes: updated.dwellTimeMinutes,
                data: scoringResult
            });
        }

        return NextResponse.json({ error: "Unsupported tracking type" }, { status: 400 });
    } catch (error: any) {
        console.error("[LeadTrackingWebhook] Failed to process tracking event:", error);
        return NextResponse.json({ 
            error: "Internal Server Error", 
            message: error.message 
        }, { status: 500 });
    }
}
