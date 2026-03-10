import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await validateApiKey(req, "leads:read");
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: leadId } = params;

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
    { params }: { params: { id: string } }
) {
    const auth = await validateApiKey(req, "leads:write");
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: leadId } = params;

    try {
        const body = await req.json();
        const { content, direction, platform } = body;

        if (!content || !direction || !platform) {
            return NextResponse.json({ error: "content, direction, and platform are required" }, { status: 400 });
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
