import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { syncGoogleMailbox } from "@/modules/email-campaigner/service/googleMailboxService";
import { z } from "zod";

const SyncSchema = z.object({
    mailboxId: z.string().min(1),
});

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const body = await req.json();
        const parsed = SyncSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
        }

        const result = await syncGoogleMailbox(ctx.teamId, parsed.data.mailboxId);
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Unable to sync Google mailbox." }, { status: 500 });
    }
}
