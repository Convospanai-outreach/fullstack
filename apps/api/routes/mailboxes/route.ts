import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import {
    buildGoogleMailboxAuthUrl,
    connectGoogleMailbox,
    listConnectedMailboxes,
    updateMailboxControls,
} from "@/modules/email-campaigner/service/googleMailboxService";

/**
 * GET /mailboxes — list all connected mailboxes for the current team
 */
export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const mailboxes = await listConnectedMailboxes(teamId);
        return NextResponse.json({ mailboxes });
    } catch (error) {
        return handleAPIError(error);
    }
}

/**
 * POST /mailboxes — start Gmail OAuth flow
 * Returns { authUrl } — the client should redirect to this URL
 */
export async function POST(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        // Connecting a mailbox is an integration action, ADMIN-only like every other
        // credential-bearing integration route (see integrations/google/mailboxes,
        // smtp/config, whatsapp/settings).
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            throw new APIError("Insufficient permissions", 403, "FORBIDDEN");
        }

        const body = await req.json().catch(() => ({}));
        const nextPath = typeof body.nextPath === "string" ? body.nextPath : "/settings/mailboxes";

        const authUrl = await buildGoogleMailboxAuthUrl({ teamId, userId, nextPath });
        return NextResponse.json({ authUrl });
    } catch (error) {
        return handleAPIError(error);
    }
}

/**
 * PATCH /mailboxes — update mailbox settings and health controls
 * Body: { mailboxId: string, dailyLimit?: number, minDelaySeconds?: number, status?: string, displayName?: string, isWarmingUp?: boolean }
 */
export async function PATCH(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        // Matches integrations/google/mailboxes/route.ts's PATCH gate exactly - without
        // this, any team member (even a read-only VIEWER) could disable/repoint a
        // mailbox or zero out its sending limits.
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            throw new APIError("Insufficient permissions", 403, "FORBIDDEN");
        }

        const body = await req.json();
        const { mailboxId, ...controls } = body || {};
        if (!mailboxId || typeof mailboxId !== "string") {
            throw new APIError("mailboxId is required", 400, "VALIDATION_ERROR");
        }

        const mailbox = await updateMailboxControls(teamId, mailboxId, controls);
        return NextResponse.json({ success: true, mailbox });
    } catch (error) {
        return handleAPIError(error);
    }
}

/**
 * DELETE /mailboxes — disconnect a mailbox by id
 * Body: { mailboxId: string }
 */
export async function DELETE(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        // Disconnecting a mailbox kills all outbound sending through it - ADMIN-only,
        // same gate as PATCH above.
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            throw new APIError("Insufficient permissions", 403, "FORBIDDEN");
        }

        const { mailboxId } = await req.json();
        if (!mailboxId) throw new APIError("mailboxId is required", 400, "VALIDATION_ERROR");

        const { prisma } = await import("@/lib/db");
        const deleted = await prisma.connectedMailbox.deleteMany({
            where: { id: mailboxId, teamId },
        });
        if (deleted.count === 0) throw new APIError("Mailbox not found", 404, "NOT_FOUND");

        return NextResponse.json({ success: true });
    } catch (error) {
        return handleAPIError(error);
    }
}

