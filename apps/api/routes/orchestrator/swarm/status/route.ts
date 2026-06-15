import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";

type TaskStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PAUSED";
type BehaviorReport = {
    persona?: string;
    scenario?: string;
    journey?: string[];
    frictionScore?: number;
    confidence?: string;
    findings?: Array<{
        scenario?: string;
        priority?: string;
        persona?: string;
        severity?: string;
        affectedSurface?: string;
        ownerArea?: string;
        friction?: string;
        recommendation?: string;
        testNeeded?: string;
    }>;
    nextBestTests?: string[];
};

function getStatusCounts(statuses: string[]) {
    const counts = {
        total: statuses.length,
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        paused: 0
    };

    for (const rawStatus of statuses) {
        const status = rawStatus.toUpperCase() as TaskStatus;
        if (status === "PENDING") counts.pending += 1;
        if (status === "RUNNING") counts.running += 1;
        if (status === "COMPLETED") counts.completed += 1;
        if (status === "FAILED") counts.failed += 1;
        if (status === "PAUSED") counts.paused += 1;
    }

    return counts;
}

export async function GET(req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const swarmId = req.nextUrl.searchParams.get("swarmId");
    if (!swarmId) {
        return NextResponse.json({ error: "swarmId is required" }, { status: 400 });
    }

    const tasks = await prisma.agentTask.findMany({
        where: {
            teamId,
            context: {
                path: ["swarmId"],
                equals: swarmId
            }
        },
        orderBy: { updatedAt: "desc" },
        select: {
            id: true,
            status: true,
            updatedAt: true,
            context: true
        }
    });

    const agentIds = tasks
        .map((task) => {
            const context = (task.context as Record<string, any> | null) ?? {};
            return typeof context.agentId === "string" ? context.agentId : null;
        })
        .filter((value): value is string => Boolean(value));

    const agents = agentIds.length > 0
        ? await prisma.agent.findMany({
            where: { id: { in: agentIds } },
            select: { id: true, name: true, status: true, updatedAt: true }
        })
        : [];

    const agentById = new Map(agents.map((agent) => [agent.id, agent]));

    const taskDetails = tasks.map((task) => {
        const context = (task.context as Record<string, any> | null) ?? {};
        const role = typeof context.role === "string" ? context.role : "Specialist";
        const agentId = typeof context.agentId === "string" ? context.agentId : "";
        const summary = typeof context?.result?.summary === "string"
            ? context.result.summary
            : null;
        const behaviorReport = typeof context?.result?.behaviorReport === "object" && context.result.behaviorReport !== null
            ? context.result.behaviorReport as BehaviorReport
            : null;
        const swarmType = typeof context.swarmType === "string" ? context.swarmType : "GENERAL_REVIEW";
        const failureReason = typeof context.failureReason === "string" ? context.failureReason : null;
        const agent = agentById.get(agentId);

        return {
            taskId: task.id,
            role,
            status: task.status,
            updatedAt: task.updatedAt,
            agentId,
            agentName: agent?.name ?? role,
            agentStatus: agent?.status ?? "unknown",
            summary,
            swarmType,
            behaviorReport,
            failureReason
        };
    });

    return NextResponse.json({
        ok: true,
        swarmId,
        counts: getStatusCounts(tasks.map((task) => task.status)),
        tasks: taskDetails
    });
}
