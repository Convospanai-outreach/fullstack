import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const auth = await validateApiKey(req, "leads:read");
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const auth = await validateApiKey(req, "leads:write");
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

        const lead = await prisma.lead.create({
            data: {
                ...body,
                teamId: auth.teamId,
                status: body.status || "NEW"
            }
        });

        return NextResponse.json(lead, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
