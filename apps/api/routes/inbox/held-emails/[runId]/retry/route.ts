import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { SequenceService } from "@/modules/email-campaigner/service/sequenceService";

// The sender fixed the contact or the step: check the held email again. It is held again if a field is still missing.
export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
    try {
        const { runId } = await params;
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const outcome = await SequenceService.retryHeldTokens(teamId, runId);
        if (!outcome.retried) return NextResponse.json({ error: "This email is not waiting for approval.", code: "NOT_WAITING" }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return handleAPIError(error);
    }
}
