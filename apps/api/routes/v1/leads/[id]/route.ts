import { NextRequest, NextResponse } from "next/server";
import { authorizeApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authResult = await authorizeApiKey(req, "leads:read");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    const rateLimit = await import("@/lib/apiRateLimit").then(m => m.checkApiRateLimit(auth.teamId));
    if (!rateLimit.success) {
        return (await import("@/lib/apiRateLimit")).rateLimitResponse(rateLimit.resetIn!);
    }

    const lead = await prisma.lead.findUnique({
        where: { id, teamId: auth.teamId },
        include: {
            emails: {
                take: 5,
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json(lead);
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authResult = await authorizeApiKey(req, "leads:write");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    const rateLimit = await import("@/lib/apiRateLimit").then(m => m.checkApiRateLimit(auth.teamId));
    if (!rateLimit.success) {
        return (await import("@/lib/apiRateLimit")).rateLimitResponse(rateLimit.resetIn!);
    }

    try {
        const body = await req.json();

        // Prevent changing teamId or ID
        delete body.id;
        delete body.teamId;

        const lead = await prisma.lead.update({
            where: { id, teamId: auth.teamId },
            data: body
        });

        return NextResponse.json(lead);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const authResult = await authorizeApiKey(req, "leads:write");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    const rateLimit = await import("@/lib/apiRateLimit").then(m => m.checkApiRateLimit(auth.teamId));
    if (!rateLimit.success) {
        return (await import("@/lib/apiRateLimit")).rateLimitResponse(rateLimit.resetIn!);
    }

    try {
        await prisma.lead.delete({
            where: { id, teamId: auth.teamId }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
