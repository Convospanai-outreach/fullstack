import { NextRequest, NextResponse } from "next/server";
import { handleAPIError } from "@/lib/apiResponse";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { decryptCredential, type EncryptedCredential } from "@/lib/security/credentialVault";
import { decodeReplyPlan, REPLY_PLAN_TYPE } from "@/modules/inbox/replySubsequenceStore";

export async function GET(req: NextRequest) {
    try {
        const { teamId, userId } = await getCurrentContextFromRequest(req);
        if (!teamId || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        const jobs = await prisma.job.findMany({
            where: { teamId, type: "scheduled_inbox_reply", OR: [
                { status: { in: ["queued", "running", "pending", "processing"] } },
                { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
            ] },
            orderBy: { processAt: "desc" }, take: 75,
            select: { id: true, payload: true, result: true, status: true, processAt: true, error: true },
        });
        const planRows = await prisma.job.findMany({
            where: { teamId, type: REPLY_PLAN_TYPE },
            orderBy: { createdAt: "desc" }, take: 25, select: { payload: true },
        });
        const plans = planRows.flatMap(row => {
            const plan = decodeReplyPlan(row.payload);
            return plan ? [plan] : [];
        });
        const references = await Promise.all(jobs.map(async job => {
            const payload = job.payload as { messageId?: unknown; replySubsequence?: { step?: unknown; runId?: unknown }; approvedReply?: EncryptedCredential } | null;
            const result = job.result as { cancelledReplyId?: unknown; skipped?: unknown; step?: unknown; runId?: unknown } | null;
            const messageId = payload?.messageId ?? result?.cancelledReplyId;
            const step = payload?.replySubsequence?.step ?? result?.step;
            const runId = payload?.replySubsequence?.runId ?? result?.runId;
            if (typeof messageId !== "string") return null;
            let approvedRecipient: string | null = null;
            try {
                const approval = JSON.parse(await decryptCredential(payload?.approvedReply) ?? "null");
                if (typeof approval?.recipient === "string") approvedRecipient = approval.recipient;
            } catch {
                // Historical rows may no longer be decryptable after a key rotation.
            }
            return { job, messageId, runId: typeof runId === "string" ? runId : null, step: typeof step === "number" ? step : null, skipped: !!result?.skipped, approvedRecipient };
        }));
        const linked = references.filter(item => item !== null);
        const messages = await prisma.message.findMany({
            where: { id: { in: [...linked.map(item => item.messageId), ...plans.map(plan => plan.anchorId)] }, direction: "INBOUND", lead: { teamId } },
            select: { id: true, lead: { select: { email: true, fullName: true } } },
        });
        const recipients = new Map(messages.map(message => [message.id, message.lead]));
        const items = linked.flatMap(({ job, messageId, runId, step, skipped, approvedRecipient }) => {
            const recipient = recipients.get(messageId);
            if (!recipient) return [];
            const status = job.error === "REPLY_SUBSEQUENCE_HELD" && job.status === "queued" ? "blocked" : skipped ? "skipped" : job.status;
            const planStep = plans.find(plan => plan.runId === runId)?.steps[step ?? -1];
            return [{ id: job.id, messageId, runId, step, recipient: approvedRecipient || recipient.email || recipient.fullName,
                sendAt: job.processAt, status: planStep?.status ?? status }];
        });
        for (const plan of plans) {
            const recipient = recipients.get(plan.anchorId);
            if (!recipient) continue;
            for (const [index, step] of plan.steps.entries()) {
                if (items.some(item => item.runId === plan.runId && item.step === index)) continue;
                items.push({ id: plan.runId + ":" + index, messageId: plan.anchorId, runId: plan.runId, step: index,
                    recipient: recipient.email || recipient.fullName, sendAt: new Date(step.dueAt), status: step.status });
            }
        }
        return NextResponse.json({ items: items.sort((a, b) => b.sendAt.getTime() - a.sendAt.getTime()) });
    } catch (error) {
        return handleAPIError(error);
    }
}
