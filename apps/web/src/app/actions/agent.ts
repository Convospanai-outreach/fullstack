
"use server";

import { AgentExecutor } from "@/modules/agent/core/AgentExecutor";
import { ApprovalService } from "@/modules/governance/ApprovalService";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function startAgentTask(goal: string, teamId: string) {
    console.log("[Action] Starting Agent Task:", goal);
    const executor = new AgentExecutor();
    const taskId = await executor.startTask(teamId, goal);

    // Fire and forget execution (it runs in background)
    executor.runToCompletion(taskId).catch(e => console.error(e));

    return { success: true, taskId };
}

export async function approveTask(requestId: string, approverId: string, revisedPayload?: any) {
    console.log("[Action] Approving Request:", requestId, revisedPayload ? "(with edits)" : "");
    await ApprovalService.approve(requestId, approverId, revisedPayload);
    revalidatePath("/dashboard");
    return { success: true };
}

export async function rejectTask(requestId: string, approverId: string) {
    console.log("[Action] Rejecting Request:", requestId);
    await ApprovalService.reject(requestId, approverId);
    revalidatePath("/dashboard");
    return { success: true };
}

export async function getPendingApprovals(teamId: string) {
    // In a real app we'd filter by teamId
    // For MVP we just return all PENDING requests joined with Task info
    const requests = await prisma.approvalRequest.findMany({
        where: {
            status: "PENDING",
            teamId: teamId
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
            detail: detail,
            status: r.status,
            payload: r.payload // Include the raw payload for editing
        };
    });
}
