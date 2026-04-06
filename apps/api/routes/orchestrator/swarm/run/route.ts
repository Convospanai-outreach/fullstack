import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { getCurrentContext } from "@/lib/auth";
import { enforcePolicy } from "@/lib/governance/guard";
import { checkLimits } from "@/lib/governance/limits";
import { audit } from "@/lib/governance/audit";

const DEFAULT_SWARM_ROLES = [
    "User Simulator",
    "Admin Operator",
    "Technical Auditor",
    "Debugger",
    "DevOps Specialist",
    "Market Researcher",
    "UI/UX Frontend",
    "Product Head",
    "CEO Advisor",
    "CTO Architect",
    "Frontend Integrator",
    "Test Executor",
    "Robustness Reviewer",
    "Adversarial Red Team",
    "Critique Partner",
    "Audit Sentinel",
];

function normalizeRoles(input: unknown): string[] {
    if (!Array.isArray(input)) {
        return DEFAULT_SWARM_ROLES;
    }

    const cleaned = input
        .map((role) => (typeof role === "string" ? role.trim() : ""))
        .filter((role) => role.length > 0);

    if (cleaned.length === 0) {
        return DEFAULT_SWARM_ROLES;
    }

    const uniqueByKey = new Map<string, string>();
    for (const role of cleaned) {
        const key = role.toLowerCase();
        if (!uniqueByKey.has(key)) {
            uniqueByKey.set(key, role);
        }
    }

    if (!Array.from(uniqueByKey.values()).some((role) => role.toLowerCase() === "frontend integrator")) {
        uniqueByKey.set("frontend integrator", "Frontend Integrator");
    }

    return Array.from(uniqueByKey.values()).slice(0, 30);
}

export async function POST(req: Request) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const goal = typeof body.goal === "string" && body.goal.trim().length > 0
        ? body.goal.trim()
        : "Audit, debug, and improve campaigns and onboarding execution";
    const roles = normalizeRoles(body.roles);
    const campaignId = typeof body.campaignId === "string" ? body.campaignId : null;
    const swarmId = `swarm_${crypto.randomUUID()}`;

    try {
        await checkLimits(teamId, "AGENT_RUN");
        await enforcePolicy({
            orgId: teamId,
            userId,
            action: "AGENT_RUN",
            payload: { swarmId, roles, campaignId, goal }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (campaignId) {
        const campaign = await prisma.campaign.findFirst({
            where: {
                id: campaignId,
                teamId
            },
            select: { id: true }
        });
        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found for team" }, { status: 404 });
        }
    }

    const launched = await Promise.all(roles.map(async (role) => {
        const existingAgent = await prisma.agent.findFirst({
            where: { name: role },
            orderBy: { updatedAt: "desc" }
        });

        const agent = existingAgent ?? await prisma.agent.create({
            data: {
                name: role,
                description: `${role} specialist for parallel swarm execution`,
                status: "idle"
            }
        });

        const task = await prisma.agentTask.create({
            data: {
                teamId,
                userId,
                goal: `[${role}] ${goal}`,
                status: "PENDING",
                plan: [
                    {
                        step: "Receive shared swarm goal",
                        status: "completed"
                    },
                    {
                        step: "Run specialist checks",
                        status: "pending"
                    },
                    {
                        step: "Publish specialist summary",
                        status: "pending"
                    }
                ],
                context: {
                    swarmId,
                    role,
                    goal,
                    campaignId,
                    agentId: agent.id,
                    startedAt: new Date().toISOString()
                }
            }
        });

        await prisma.activity.create({
            data: {
                type: "swarm-agent-queued",
                message: `${role} queued`,
                agentId: agent.id,
                meta: {
                    swarmId,
                    taskId: task.id,
                    role,
                    goal,
                    campaignId
                }
            }
        });

        const job = await JobQueue.enqueue(
            "agent_run",
            {
                agentId: agent.id,
                userId,
                teamId,
                role,
                taskId: task.id,
                swarmId,
                goal,
                campaignId
            },
            {
                teamId,
                correlationId: swarmId,
                auditContext: { source: "orchestrator/swarm/run", role, taskId: task.id }
            }
        );

        return {
            role,
            agentId: agent.id,
            taskId: task.id,
            jobId: job.id
        };
    }));

    await audit({
        actorId: userId,
        orgId: teamId,
        action: "AGENT_SWARM_RUN",
        entity: "AgentTask",
        entityId: swarmId,
        metadata: {
            goal,
            roles,
            campaignId,
            launchedCount: launched.length,
            launched
        }
    });

    return NextResponse.json({
        ok: true,
        swarmId,
        goal,
        launched: launched.length,
        jobs: launched
    });
}
