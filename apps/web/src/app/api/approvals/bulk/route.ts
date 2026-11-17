import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { authorizePermission, Permission } from "@/lib/permissions";
import { internalErrorMessage } from "@/lib/internalError";

export const dynamic = "force-dynamic";

const MAX_BULK = 50;

// Approve or reject several held AI messages in one go. Only MESSAGE_SEND rows: the other
// approval types have their own rules (campaign starts, posts) and stay one at a time.
// Each row goes through the same claim-first path as a single decision, so a row someone else
// already decided is reported back and nothing is sent twice.
export async function POST(req: NextRequest) {
    try {
        const { prisma } = await import("@/lib/db");
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        await authorizePermission(ctx.userId, ctx.teamId, Permission.RESOLVE_APPROVALS);

        const body = await req.json().catch(() => ({}));
        const { action, reason } = body;
        if (action !== "APPROVE" && action !== "REJECT") {
            return NextResponse.json({ error: "action must be APPROVE or REJECT" }, { status: 400 });
        }
        if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.some((id: unknown) => typeof id !== "string")) {
            return NextResponse.json({ error: "ids must be a non-empty list of approval ids" }, { status: 400 });
        }
        const ids: string[] = [...new Set<string>(body.ids)];
        if (ids.length > MAX_BULK) {
            return NextResponse.json({ error: `Select at most ${MAX_BULK} messages at a time.` }, { status: 400 });
        }

        const rows = await prisma.approvalRequest.findMany({
            where: { id: { in: ids }, teamId: ctx.teamId, actionType: "MESSAGE_SEND" },
        });
        const byId = new Map(rows.map((row) => [row.id, row]));

        const { approveMessageSend, rejectMessageSend } = await import("@/modules/governance/messageApproval");
        const results: { id: string; ok: boolean; error?: string }[] = [];
        // One at a time: each approval queues a real send, and a failure on one must not stop the rest.
        for (const id of ids) {
            const row = byId.get(id);
            if (!row) {
                results.push({ id, ok: false, error: "Not a message waiting for approval." });
                continue;
            }
            try {
                if (action === "REJECT") {
                    const rejected = await rejectMessageSend(id, ctx.teamId, ctx.userId, reason);
                    results.push(rejected ? { id, ok: true } : { id, ok: false, error: "Already decided." });
                } else {
                    await approveMessageSend(row, ctx.teamId, ctx.userId);
                    results.push({ id, ok: true });
                }
            } catch (err: any) {
                results.push({ id, ok: false, error: err?.message || "Could not update this approval." });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        console.error("Failed to process bulk approval:", error);
        const status = error?.statusCode || 500;
        return NextResponse.json({ error: status < 500 ? error.message : internalErrorMessage(error, "Internal Server Error") }, { status });
    }
}
