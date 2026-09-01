import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { getCurrentContext } from "@/lib/auth";
import { enforcePolicy } from "@/lib/governance/guard";
import { checkLimits } from "@/lib/governance/limits";
import { audit } from "@/lib/governance/audit";
import { swarmLimiter } from "@/lib/rate-limit";

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

const USER_BEHAVIOR_ROLES = [
    "First-time Founder User",
    "Sales Operator User",
    "RevOps Manager User",
    "Workspace Admin User",
    "UI/UX Frontend",
    "Adversarial Red Team",
    "Test Executor",
    "Product Head",
];

const MODE_DEFAULTS = {
    GENERAL_REVIEW: {
        goal: "Audit, debug, and improve campaigns and onboarding execution",
        roles: DEFAULT_SWARM_ROLES,
    },
    USER_BEHAVIOR: {
        goal: "Simulate core user behavior across signup, lead capture, email outreach, LinkedIn follow-up, and funnel updates",
        roles: USER_BEHAVIOR_ROLES,
    },
    LAUNCH_READINESS: {
        goal: "Simulate workspace admin launch readiness across Clerk auth, Postgres sync, setup, env configuration, team invites, and governance checks",
        roles: ["Workspace Admin User", "Technical Auditor", "DevOps Specialist", "Audit Sentinel", "Product Head"],
    },
    LEAD_JOURNEY: {
        goal: "Simulate one lead journey across email, LinkedIn, WhatsApp, call, manual status updates, follow-up suggestions, and funnel progression",
        roles: ["Sales Operator User", "RevOps Manager User", "Test Executor", "UI/UX Frontend", "Adversarial Red Team"],
    },
    ADMIN_SETUP: {
        goal: "Simulate admin setup for invite approval, permissions, feature readiness, audit trail, and deployment confidence",
        roles: ["Workspace Admin User", "Admin Operator", "Technical Auditor", "DevOps Specialist", "Audit Sentinel"],
    },
} as const;

function normalizeSwarmType(input: unknown) {
    if (input === "USER_BEHAVIOR" || input === "LAUNCH_READINESS" || input === "LEAD_JOURNEY" || input === "ADMIN_SETUP") {
        return input;
    }
    return "GENERAL_REVIEW";
}

function normalizeRoles(input: unknown, fallbackRoles: readonly string[]): string[] {
    if (!Array.isArray(input)) {
        return [...fallbackRoles];
    }

    const cleaned = input
        .map((role) => (typeof role === "string" ? role.trim() : ""))
        .filter((role) => role.length > 0);

    if (cleaned.length === 0) {
        return [...fallbackRoles];
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

    // A swarm launches up to 30 concurrent LLM-backed agent jobs per request - a double
    // submit or client retry with no guard here would silently multiply that cost.
    const { isRateLimited } = swarmLimiter.check(1, teamId);
    if (isRateLimited) {
        return NextResponse.json({ error: "Swarm rate limit exceeded. Please wait a minute before launching another swarm." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const swarmType = normalizeSwarmType(body.swarmType);
    const modeDefaults = MODE_DEFAULTS[swarmType];
    const goal = typeof body.goal === "string" && body.goal.trim().length > 0
        ? body.goal.trim()
        : modeDefaults.goal;
    const roles = normalizeRoles(body.roles, modeDefaults.roles);
    const campaignId = typeof body.campaignId === "string" ? body.campaignId : null;
    const swarmId = `swarm_${crypto.randomUUID()}`;

    try {
        await checkLimits(teamId, "AGENT_RUN");
        await enforcePolicy({
            orgId: teamId,
            userId,
            action: "AGENT_RUN",
            payload: { swarmId, roles, campaignId, goal, swarmType }
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
                    swarmType,
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
                    swarmType,
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
                swarmType,
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
            swarmType,
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
        swarmType,
        launched: launched.length,
        jobs: launched
    });
}
