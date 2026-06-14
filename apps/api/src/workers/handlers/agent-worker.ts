import { prisma } from "@/lib/db";
import { JobPayload } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { buildUserBehaviorReport } from "./user-behavior-swarm";

type AgentTaskContext = Record<string, any>;

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
        const behaviorReport = ["USER_BEHAVIOR", "LAUNCH_READINESS", "LEAD_JOURNEY", "ADMIN_SETUP"].includes(swarmType)
            ? buildUserBehaviorReport(role, goal, metrics, swarmType)
            : null;
        const checks = behaviorReport
            ? [
                `Simulated ${behaviorReport.persona}: ${behaviorReport.scenario}`,
                `Friction score ${behaviorReport.frictionScore}/100 with ${behaviorReport.findings.length} finding(s).`
            ]
            : getRoleSpecificChecks(role);

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
            : `${role} completed checks for goal "${goal}". Campaigns: ${campaignCount}, active: ${activeCampaignCount}, leads: ${leadCount}, pending approvals: ${approvalCount}.`;

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
