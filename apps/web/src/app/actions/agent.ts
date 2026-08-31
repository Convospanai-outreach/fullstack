
"use server";

import { AgentExecutor } from "@/modules/agent/core/AgentExecutor";
import { ApprovalService } from "@/modules/governance/ApprovalService";
import { getCurrentContext } from "@/lib/auth";
import { authorizePermission, Permission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// These are Next.js Server Actions - directly callable with arbitrary arguments by
// any authenticated client, not just through the UI that happens to render them. Every
// export here must derive identity/team from the real server-side session and verify
// ownership/permission itself; none of the parameters below (teamId, approverId) can be
// trusted as proof of who the caller is or what team they belong to.

export async function startAgentTask(goal: string, _teamId: string) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) throw new Error("Unauthorized");

    console.log("[Action] Starting Agent Task:", goal);
    const executor = new AgentExecutor();
    const taskId = await executor.startTask(teamId, goal);

    // Fire and forget execution (it runs in background)
    executor.runToCompletion(taskId).catch(e => console.error(e));

    return { success: true, taskId };
}

export async function approveTask(requestId: string, _approverId: string, revisedPayload?: any) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) throw new Error("Unauthorized");
    await authorizePermission(userId, teamId, Permission.RESOLVE_APPROVALS);

    const request = await prisma.approvalRequest.findFirst({ where: { id: requestId, teamId } });
    if (!request) throw new Error("Request not found");

    console.log("[Action] Approving Request:", requestId, revisedPayload ? "(with edits)" : "");
    await ApprovalService.approve(requestId, userId, revisedPayload);
    revalidatePath("/dashboard");
    return { success: true };
}

export async function rejectTask(requestId: string, _approverId: string) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) throw new Error("Unauthorized");
    await authorizePermission(userId, teamId, Permission.RESOLVE_APPROVALS);

    const request = await prisma.approvalRequest.findFirst({ where: { id: requestId, teamId } });
    if (!request) throw new Error("Request not found");

    console.log("[Action] Rejecting Request:", requestId);
    await ApprovalService.reject(requestId, userId);
    revalidatePath("/dashboard");
    return { success: true };
}

export async function getPendingApprovals(_teamId: string) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) throw new Error("Unauthorized");

    const requests = await prisma.approvalRequest.findMany({
        where: {
            status: "PENDING",
            teamId
        },
        orderBy: { createdAt: 'desc' }
    });
    type ApprovalRequestRecord = (typeof requests)[number];

    return requests.map((r: ApprovalRequestRecord) => {
        let detail = "Approval Required";
        try {
            const p = r.payload ? JSON.parse(r.payload as string) : {};
            detail = p.goal || p.description || `Action: ${r.actionType}`;
        } catch (e) {
            detail = `Action: ${r.actionType}`;
        }

        return {
            id: r.id,
            type: r.actionType,
            risk: "HIGH",
            tier: r.tier,
            detail: detail,
            status: r.status,
            payload: r.payload // Include the raw payload for editing
        };
    });
}
