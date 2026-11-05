import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { dkimProofConfigFromEnv, proveDkim } from "@/modules/email-campaigner/service/dkimProof";

const STATUS: Record<string, number> = { NOT_CONFIGURED: 503, MAILBOX_NOT_FOUND: 404, SEND_FAILED: 502, NOT_RECEIVED: 504 };

// Sends one test message from an SMTP mailbox to the proof inbox and reports whether the receiver saw a
// valid DKIM signature. Admin only, because each call sends a real message.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        if (!dkimProofConfigFromEnv()) {
            return NextResponse.json({ error: "The DKIM proof isn't set up yet.", code: "NOT_CONFIGURED" }, { status: 503 });
        }
        const { id } = await params;
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const outcome = await proveDkim({ teamId, mailboxId: id });
        if (!outcome.ok) {
            return NextResponse.json({ error: "The DKIM proof could not be completed.", code: outcome.code }, { status: STATUS[outcome.code] ?? 502 });
        }
        return NextResponse.json({ ok: true, verdict: outcome.verdict });
    } catch (error) {
        return handleAPIError(error);
    }
}
