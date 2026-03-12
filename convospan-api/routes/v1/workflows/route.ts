import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const auth = await validateApiKey(req, "workflows:read");
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    const [workflows, total] = await Promise.all([
        prisma.workflow.findMany({
            where: { teamId: auth.teamId },
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' }
        }),
        prisma.workflow.count({ where: { teamId: auth.teamId } })
    ]);

    return NextResponse.json({
        data: workflows,
        meta: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total
        }
    });
}

export async function POST(req: NextRequest) {
    const auth = await validateApiKey(req, "workflows:write");
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        
        if (!body.name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const workflow = await prisma.workflow.create({
            data: {
                name: body.name,
                description: body.description,
                nodes: body.nodes || [],
                edges: body.edges || [],
                triggerType: body.triggerType || "MANUAL",
                teamId: auth.teamId,
                isActive: body.isActive ?? false
            }
        });

        return NextResponse.json(workflow, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
