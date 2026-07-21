import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import {
    buildGoogleMailboxAuthUrl,
    connectGoogleMailbox,
    listConnectedMailboxes,
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

        const body = await req.json().catch(() => ({}));
        const nextPath = typeof body.nextPath === "string" ? body.nextPath : "/settings/mailboxes";

        const authUrl = await buildGoogleMailboxAuthUrl({ teamId, userId, nextPath });
        return NextResponse.json({ authUrl });
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
