import { NextRequest, NextResponse } from "next/server";
import { authorizeApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";
import { agentExecutor } from "@/modules/agent/core/AgentExecutor";

export async function GET(req: NextRequest) {
    const authResult = await authorizeApiKey(req, "tasks:read");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");

    const where: any = { teamId: auth.teamId };
    if (status) {
        where.status = status;
    }

    const [tasks, total] = await Promise.all([
        prisma.agentTask.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { logs: true }
                }
            }
        }),
        prisma.agentTask.count({ where })
    ]);

    return NextResponse.json({
        data: tasks,
        meta: {
            limit,
            offset,
            total,
            hasMore: offset + limit < total
        }
    });
}

export async function POST(req: NextRequest) {
    const authResult = await authorizeApiKey(req, "tasks:write");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    try {
        const body = await req.json();
        
        if (!body.goal) {
            return NextResponse.json({ error: "Goal is required" }, { status: 400 });
        }

        const taskId = await agentExecutor.startTask(
            auth.teamId,
            body.goal,
            body.context || {}
        );

        const task = await prisma.agentTask.findFirst({
            where: { id: taskId, teamId: auth.teamId },
        });

        return NextResponse.json(task, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
