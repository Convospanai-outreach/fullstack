import { NextRequest, NextResponse } from "next/server";
import { validateExtensionAuth } from "../../../_lib/auth";
import { resolveExtensionTeamScope } from "../../../_lib/teamScope";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { chooseSequenceForLead } from "@/services/extensionLeadCaptureService";

// Adds a synced lead to a sequence chosen in the extension popup. Starting a sequence sends email,
// so it needs the same team role as enrolling leads in the app (MEMBER, not VIEWER).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ success: false, error: auth.error, code: auth.code }, { status: auth.status });
        }
        const body = await req.json().catch(() => ({}));
        const requestedTeamId = typeof body.teamId === "string" ? body.teamId.trim() : req.headers.get("x-team-id");
        const teamScope = resolveExtensionTeamScope(auth.teamIds, requestedTeamId);
        if (!teamScope.ok) {
            return NextResponse.json({ success: false, error: teamScope.error, code: teamScope.code }, { status: teamScope.status });
        }
        if (!await checkTeamPermission(auth.user.id, teamScope.teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ success: false, error: "Viewers can't add leads to sequences.", code: "INSUFFICIENT_ROLE" }, { status: 403 });
        }
        const sequenceId = typeof body.sequenceId === "string" ? body.sequenceId.trim() : "";
        if (!sequenceId) {
            return NextResponse.json({ success: false, error: "Choose a sequence.", code: "SEQUENCE_REQUIRED" }, { status: 400 });
        }

        const { id } = await params;
        const result = await chooseSequenceForLead({ teamId: teamScope.teamId, userId: auth.user.id, leadId: id, sequenceId });
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal error";
        const status = message === "Lead not found" ? 404 : message === "Sequence not available" ? 400 : 500;
        return NextResponse.json({ success: false, error: message }, { status });
    }
}
