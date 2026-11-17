import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { SequenceService } from "@/modules/email-campaigner/service/sequenceService";

// The sender agrees to send a held email with the suggested fallbacks (for example "there" for a missing first
// name). Refused when a field has no usable fallback: those have to be fixed on the contact or in the step.
export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
    try {
        const { runId } = await params;
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const outcome = await SequenceService.approveTokenFallbacks(teamId, runId);
        if (outcome.approved) return NextResponse.json({ ok: true });
        if (outcome.reason === "NEEDS_FIX") {
            return NextResponse.json(
                { error: "These fields have no fallback to send with. Fix them on the contact or in the step first.", code: "NEEDS_FIX", tokens: outcome.tokens },
                { status: 409 },
            );
        }
        return NextResponse.json({ error: "This email is not waiting for approval.", code: "NOT_WAITING" }, { status: 404 });
    } catch (error) {
        return handleAPIError(error);
    }
}
