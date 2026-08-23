import { NextRequest, NextResponse } from "next/server";
import { authorizeApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await authorizeApiKey(req, "leads:read");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    const { id: leadId } = await params;

    const messages = await prisma.message.findMany({
        where: { 
            leadId,
            lead: { teamId: auth.teamId }
        },
        orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ data: messages });
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await authorizeApiKey(req, "leads:write");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    const { id: leadId } = await params;

    try {
        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
        }
        const { content, direction, platform } = body;

        if (!content || !direction || !platform) {
            return NextResponse.json({ error: "content, direction, and platform are required" }, { status: 400 });
        }

        const lead = await prisma.lead.findFirst({
            where: { id: leadId, teamId: auth.teamId },
            select: { id: true },
        });

        if (!lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        const message = await prisma.message.create({
            data: {
                leadId,
                content,
                direction,
                platform,
                status: direction === "OUTBOUND" ? "sent" : "received"
            }
        });

        return NextResponse.json(message, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
