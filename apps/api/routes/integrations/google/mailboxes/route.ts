import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { listConnectedMailboxes, updateMailboxControls } from "@/modules/email-campaigner/service/googleMailboxService";
import { z } from "zod";

const UpdateMailboxSchema = z.object({
    mailboxId: z.string().min(1),
    assignedUserId: z.string().min(1).nullable().optional(),
    displayName: z.string().min(1).nullable().optional(),
    dailyLimit: z.number().int().min(1).max(2000).optional(),
    minDelaySeconds: z.number().int().min(30).max(86400).optional(),
    isWarmingUp: z.boolean().optional(),
    warmupDay: z.number().int().min(0).max(365).optional(),
    status: z.enum(["CONNECTED", "PAUSED", "NEEDS_RECONNECT", "DISABLED"]).optional(),
});

export async function GET(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const mailboxes = await listConnectedMailboxes(ctx.teamId);
        return NextResponse.json({ mailboxes });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Unable to load mailboxes." }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const body = await req.json();
        const parsed = UpdateMailboxSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
        }

        const { mailboxId, ...data } = parsed.data;
        const mailbox = await updateMailboxControls(ctx.teamId, mailboxId, data);
        return NextResponse.json({ mailbox });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Unable to update mailbox." }, { status: 500 });
    }
}
