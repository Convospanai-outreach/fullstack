import { NextRequest, NextResponse } from "next/server";
import { authorizeApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const authResult = await authorizeApiKey(req, "agents:read");
    if (!authResult.ok) return authResult.response;

    const agents = await prisma.agent.findMany({
        orderBy: { name: 'asc' }
    });

    return NextResponse.json({ data: agents });
}

export async function POST(req: NextRequest) {
    const authResult = await authorizeApiKey(req, "agents:write");
    if (!authResult.ok) return authResult.response;

    try {
        const body = await req.json();
        
        if (!body.name) {
            return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
        }

        const agent = await prisma.agent.create({
            data: {
                name: body.name,
                description: body.description,
                status: "idle"
            }
        });

        return NextResponse.json(agent, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
