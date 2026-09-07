import { prisma } from "@/lib/db";
import { JobPayload } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { aiService } from "@/lib/aiService";
import { generateUserBehaviorReport, SwarmMetrics } from "./user-behavior-swarm";

type AgentTaskContext = Record<string, any>;

function parseJsonResponse<T>(raw: string): T {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(cleaned) as T;
}

/**
 * LLM-backed specialist review. Falls back to the static, deterministic
 * getRoleSpecificChecks() below on any LLM failure or malformed
 * response, so a provider outage never breaks the swarm run.
 */
async function generateRoleChecks(
    role: string,
    goal: string,
    metrics: SwarmMetrics,
    teamId: string | null
): Promise<{ checks: [string, string]; summary?: string }> {
    try {
        const prompt = `You are "${role}", a specialist reviewer auditing a live B2B outreach SaaS workspace.

Operator's stated goal for this review: "${goal}"

Live workspace data for the team being audited (ground your review in this, do not invent data):
- Campaigns: ${metrics.campaigns} (${metrics.activeCampaigns} active)
- Leads: ${metrics.leads}
- Pending approvals: ${metrics.pendingApprovals}

Perform your specialist review for this role and goal, using the live data above. Respond with ONLY a single JSON object, no markdown fences, no commentary:
{
  "checks": ["<first concrete action/observation you took>", "<second concrete action/observation you took>"],
  "summary": "<one to two sentence summary of what you found for this role and goal, grounded in the data above>"
}`;

        const raw = await aiService.askAI(prompt, teamId || undefined, {
            taskType: "AGENT_SWARM_REVIEW",
            surface: "HELPER",
            expectsJson: true,
            disableGuardrails: true
        });
        const parsed = parseJsonResponse<{ checks?: unknown; summary?: unknown }>(raw);
        const checks = Array.isArray(parsed.checks) && parsed.checks.length >= 2
            && typeof parsed.checks[0] === "string" && typeof parsed.checks[1] === "string"
            ? [String(parsed.checks[0]).slice(0, 400), String(parsed.checks[1]).slice(0, 400)] as [string, string]
            : null;
        if (!checks) throw new Error("Malformed specialist review response");

        const summary = typeof parsed.summary === "string" && parsed.summary.trim().length > 0
            ? parsed.summary.trim().slice(0, 600)
            : undefined;

        return { checks, summary };
    } catch (error) {
        return { checks: getRoleSpecificChecks(role) as [string, string] };
    }
}

function getRoleSpecificChecks(role: string): string[] {
    const normalized = role.trim().toLowerCase();

    if (normalized.includes("user")) {
        return [
            "Validated core user flow and onboarding handoff states.",
            "Checked task copy for clarity and next-step guidance."
        ];
    }

    if (normalized.includes("admin")) {
        return [
            "Reviewed admin-facing controls and queue visibility.",
            "Verified governance checkpoints before execution."
        ];
    }

    if (normalized.includes("auditor")) {
        return [
            "Audited workflow execution logs for missing traceability.",
            "Checked consistency between queue status and UI status."
        ];
    }

    if (normalized.includes("debug")) {
        return [
            "Scanned recent failures and stale task states.",
            "Flagged mismatch risks between route payload and worker expectations."
        ];
    }

    if (normalized.includes("devops")) {
        return [
            "Checked runtime readiness and fallback behavior.",
            "Validated queue and worker handoff resilience."
        ];
    }

    if (normalized.includes("research")) {
        return [
            "Compiled context signals from available campaign and lead data.",
            "Generated practical insights for faster follow-up execution."
        ];
    }

    if (normalized.includes("ui") || normalized.includes("frontend") || normalized.includes("ux")) {
        return [
            "Reviewed navigation and onboarding discoverability gaps.",
            "Suggested friction-reduction improvements for first campaign launch."
        ];
    }

    if (normalized.includes("product")) {
        return [
            "Validated feature sequencing against onboarding readiness.",
            "Checked whether high-value outcomes are visible in the first session."
        ];
    }

    if (normalized.includes("ceo")) {
        return [
            "Reviewed top-line execution clarity and velocity blockers.",
            "Assessed launch readiness from a business outcome lens."
        ];
    }

    if (normalized.includes("cto")) {
        return [
            "Checked technical execution path for risk and extensibility.",
            "Validated backend/frontend contract completeness."
        ];
    }

    return [
        "Reviewed workload state and execution readiness.",
        "Prepared role-specific recommendations for the swarm summary."
    ];
}

async function appendTaskLog(
    taskId: string,
    stepNumber: number,
    type: "SYSTEM" | "ACTION" | "OBSERVATION",
    content: string,
    metadata?: Record<string, any>
) {
    await prisma.agentLog.create({
        data: {
            taskId,
            stepNumber,
            type,
            content,
            metadata: metadata ?? undefined
        }
    });
}

export async function handleAgentRun(payload: JobPayload) {
    const agentId = typeof payload.agentId === "string" ? payload.agentId : null;
    const taskId = typeof payload.taskId === "string" ? payload.taskId : null;
    const teamId = typeof payload.teamId === "string" ? payload.teamId : null;
    const role = typeof payload.role === "string" ? payload.role : "Specialist";
    const goal = typeof payload.goal === "string" && payload.goal.trim().length > 0
        ? payload.goal.trim()
        : "Execute assigned specialist checks";
    const swarmId = typeof payload.swarmId === "string" ? payload.swarmId : null;
    const swarmType = typeof payload.swarmType === "string" ? payload.swarmType : "GENERAL_REVIEW";

    if (!agentId) {
        throw new Error("Missing agentId");
    }

    if (taskId && teamId) {
        // taskId is caller-controlled (reachable via the generic POST
        // /api/jobs endpoint, OPEN-158) - verify it actually belongs to
        // this job's team before mutating its status/context/logs, or a
        // caller could corrupt or fabricate progress on another team's
        // AgentTask.
        const ownedTask = await prisma.agentTask.findFirst({
            where: { id: taskId, teamId },
            select: { id: true }
        });
        if (!ownedTask) {
            throw new Error(`AgentTask ${taskId} does not belong to team ${teamId}`);
        }
    }

    let stepNumber = 1;

    try {
        await prisma.agent.update({
            where: { id: agentId },
            data: { status: "running" }
        });

        if (taskId) {
            await prisma.agentTask.update({
                where: { id: taskId },
                data: { status: "RUNNING" }
            });

            await appendTaskLog(taskId, stepNumber++, "SYSTEM", `Started ${role} run.`, {
                role,
                swarmId,
                goal
            });
        }

        const [campaignCount, activeCampaignCount, leadCount, approvalCount] = await Promise.all([
            prisma.campaign.count({
                where: teamId ? { teamId } : {}
            }),
            prisma.campaign.count({
                where: teamId ? { teamId, status: { in: ["active", "ACTIVE"] } } : { status: { in: ["active", "ACTIVE"] } }
            }),
            prisma.lead.count({
                where: teamId ? { teamId } : {}
            }),
            prisma.approvalRequest.count({
                where: teamId ? { teamId, status: "PENDING" } : { status: "PENDING" }
            })
        ]);

        const metrics = {
            campaigns: campaignCount,
            activeCampaigns: activeCampaignCount,
            leads: leadCount,
            pendingApprovals: approvalCount
        };
        const isBehaviorSwarm = ["USER_BEHAVIOR", "LAUNCH_READINESS", "LEAD_JOURNEY", "ADMIN_SETUP"].includes(swarmType);
        const behaviorReport = isBehaviorSwarm
            ? await generateUserBehaviorReport(role, goal, metrics, swarmType, teamId, (prompt, tid, opts) => aiService.askAI(prompt, tid, opts))
            : null;
        const roleReview = !isBehaviorSwarm ? await generateRoleChecks(role, goal, metrics, teamId) : null;
        const checks = behaviorReport
            ? [
                `Simulated ${behaviorReport.persona}: ${behaviorReport.scenario}`,
                `Friction score ${behaviorReport.frictionScore}/100 with ${behaviorReport.findings.length} finding(s).`
            ]
            : roleReview!.checks;

        if (taskId) {
            await appendTaskLog(taskId, stepNumber++, "ACTION", checks[0], {
                campaigns: campaignCount,
                leads: leadCount,
                swarmType,
                behaviorReport: behaviorReport ?? undefined
            });
            await appendTaskLog(taskId, stepNumber++, "OBSERVATION", checks[1], {
                activeCampaigns: activeCampaignCount,
                pendingApprovals: approvalCount,
                swarmType,
                behaviorFindings: behaviorReport?.findings
            });
        }

        const summary = behaviorReport
            ? `${role} simulated ${behaviorReport.persona}. Friction score: ${behaviorReport.frictionScore}/100. Top issue: ${behaviorReport.findings[0]?.friction ?? "No major behavior blocker detected."}`
            : roleReview!.summary
                ?? `${role} completed checks for goal "${goal}". Campaigns: ${campaignCount}, active: ${activeCampaignCount}, leads: ${leadCount}, pending approvals: ${approvalCount}.`;

        if (taskId) {
            const task = await prisma.agentTask.findUnique({
                where: { id: taskId },
                select: { context: true, plan: true }
            });

            const existingContext: AgentTaskContext = (task?.context as AgentTaskContext) || {};
            const existingPlan = Array.isArray(task?.plan) ? (task?.plan as any[]) : [];

            await prisma.agentTask.update({
                where: { id: taskId },
                data: {
                    status: "COMPLETED",
                    context: {
                        ...existingContext,
                        role,
                        swarmId,
                        swarmType,
                        completedAt: new Date().toISOString(),
                        result: {
                            summary,
                            metrics,
                            behaviorReport: behaviorReport ?? undefined
                        }
                    },
                    plan: [
                        ...existingPlan,
                        {
                            step: "Run specialist checks",
                            status: "completed",
                            completedAt: new Date().toISOString()
                        }
                    ]
                }
            });

            await appendTaskLog(taskId, stepNumber++, "SYSTEM", "Task marked as COMPLETED.", {
                summary
            });
        }

        await prisma.activity.create({
            data: {
                type: "agent-run-complete",
                message: `${role} finished`,
                agentId,
                meta: {
                    swarmId,
                    swarmType,
                    role,
                    goal,
                    summary,
                    behaviorReport: behaviorReport ?? undefined
                }
            }
        });

        await prisma.agent.update({
            where: { id: agentId },
            data: { status: "idle" }
        });

        return {
            success: true,
            role,
            summary,
            swarmId,
            swarmType,
            behaviorReport,
            metrics: {
                campaigns: campaignCount,
                activeCampaigns: activeCampaignCount,
                leads: leadCount,
                pendingApprovals: approvalCount
            }
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown agent worker error";
        logger.error("[Worker] agent_run failed", { agentId, taskId, role, error: message });

        if (taskId) {
            try {
                const task = await prisma.agentTask.findUnique({
                    where: { id: taskId },
                    select: { context: true }
                });
                const existingContext: AgentTaskContext = (task?.context as AgentTaskContext) || {};

                await prisma.agentTask.update({
                    where: { id: taskId },
                    data: {
                        status: "FAILED",
                        context: {
                        ...existingContext,
                        role,
                        swarmId,
                        swarmType,
                        failedAt: new Date().toISOString(),
                        failureReason: message
                    }
                    }
                });

                const count = await prisma.agentLog.count({ where: { taskId } });
                await appendTaskLog(taskId, count + 1, "OBSERVATION", `Task failed: ${message}`);
            } catch (taskError) {
                logger.error("[Worker] failed to update task after agent_run error", {
                    taskId,
                    taskError: taskError instanceof Error ? taskError.message : "Unknown"
                });
            }
        }

        try {
            await prisma.agent.update({
                where: { id: agentId },
                data: { status: "idle" }
            });
        } catch {
            // ignore secondary errors
        }

        throw error;
    }
}
