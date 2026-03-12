import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const auth = await validateApiKey(req, "agents:read");
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agents = await prisma.agent.findMany({
        orderBy: { name: 'asc' }
    });

    return NextResponse.json({ data: agents });
}

export async function POST(req: NextRequest) {
    const auth = await validateApiKey(req, "agents:write");
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
