import { NextRequest, NextResponse } from "next/server";
import { validateExtensionAuth } from "../_lib/auth";
import { resolveExtensionTeamScope } from "../_lib/teamScope";
import { listSequencesForExtension } from "@/services/extensionLeadCaptureService";
import { internalErrorMessage } from "@/lib/internalError";

// Sequences the extension popup offers after a lead is synced.
export async function GET(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ success: false, error: auth.error, code: auth.code }, { status: auth.status });
        }
        const teamScope = resolveExtensionTeamScope(auth.teamIds, req.headers.get("x-team-id"));
        if (!teamScope.ok) {
            return NextResponse.json({ success: false, error: teamScope.error, code: teamScope.code }, { status: teamScope.status });
        }
        const sequences = await listSequencesForExtension(teamScope.teamId);
        return NextResponse.json({ success: true, sequences });
    } catch (error) {
        return NextResponse.json({ success: false, error: internalErrorMessage(error, "Internal error") }, { status: 500 });
    }
}
