import { NextRequest, NextResponse } from "next/server";
import { authorizeApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";

// System-managed fields (pipelineState, intentScore, leadScore, isEnriched,
// wonAt/lostAt, etc.) must not be settable from a caller-supplied body -
// see the identical allowlist in routes/leads/[id]/route.ts.
const ALLOWED_CREATE_FIELDS = new Set([
    "fullName", "email", "phone", "linkedIn",
    "company", "jobTitle", "location",
    "status", "tags", "crmId", "value", "campaignId",
    "consentObtained",
    "whatsappConsent", "whatsappNumber",
    "preferredMeetingType", "meetingLocation",
]);

export async function GET(req: NextRequest) {
    const authResult = await authorizeApiKey(req, "leads:read");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    const rateLimit = await import("@/lib/apiRateLimit").then(m => m.checkApiRateLimit(auth.teamId));
    if (!rateLimit.success) {
        return (await import("@/lib/apiRateLimit")).rateLimitResponse(rateLimit.resetIn!);
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");
    const search = searchParams.get("q");

    const where: any = { teamId: auth.teamId };

    if (status) {
        where.status = status;
    }

    if (search) {
        where.OR = [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } }
        ];
    }

    const [leads, total] = await Promise.all([
        prisma.lead.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' }
        }),
        prisma.lead.count({ where })
    ]);

    return NextResponse.json({
        data: leads,
        meta: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total
        }
    });
}

export async function POST(req: NextRequest) {
    const authResult = await authorizeApiKey(req, "leads:write");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    const rateLimit = await import("@/lib/apiRateLimit").then(m => m.checkApiRateLimit(auth.teamId));
    if (!rateLimit.success) {
        return (await import("@/lib/apiRateLimit")).rateLimitResponse(rateLimit.resetIn!);
    }

    try {
        const body = await req.json();

        // Basic validation
        if (!body.email && !body.linkedIn) {
            return NextResponse.json({ error: "Email or LinkedIn required" }, { status: 400 });
        }

        if (body.campaignId) {
            const campaign = await prisma.campaign.findFirst({
                where: { id: body.campaignId, teamId: auth.teamId },
                select: { id: true },
            });
            if (!campaign) {
                return NextResponse.json({ error: "Invalid campaignId" }, { status: 400 });
            }
        }

        const data: Record<string, any> = {};
        for (const [key, val] of Object.entries(body ?? {})) {
            if (ALLOWED_CREATE_FIELDS.has(key)) {
                data[key] = val;
            }
        }

        const lead = await prisma.lead.create({
            data: {
                ...data,
                teamId: auth.teamId,
                status: data.status || "NEW"
            }
        });

        return NextResponse.json(lead, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
