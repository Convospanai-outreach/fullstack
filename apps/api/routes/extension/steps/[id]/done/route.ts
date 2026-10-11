import { NextRequest, NextResponse } from "next/server";
import { validateExtensionAuth } from "../../../_lib/auth";
import { resolveExtensionTeamScope } from "../../../_lib/teamScope";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { completeLinkedInStep } from "@/services/extensionLeadCaptureService";

// Marks a LinkedIn sequence step done from the extension's list. The sequence then moves on, and
// its next step can send email, so this needs the same team role as enrolling leads (MEMBER).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ success: false, error: auth.error, code: auth.code }, { status: auth.status });
        }
        const teamScope = resolveExtensionTeamScope(auth.teamIds, req.headers.get("x-team-id"));
        if (!teamScope.ok) {
            return NextResponse.json({ success: false, error: teamScope.error, code: teamScope.code }, { status: teamScope.status });
        }
        if (!await checkTeamPermission(auth.user.id, teamScope.teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ success: false, error: "Viewers can't mark sequence steps done.", code: "INSUFFICIENT_ROLE" }, { status: 403 });
        }

        const { id } = await params;
        const result = await completeLinkedInStep({ teamId: teamScope.teamId, userId: auth.user.id, runId: id });
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal error";
        const status = message === "Step not found" || message === "Lead not found" ? 404 : 500;
        return NextResponse.json({ success: false, error: message }, { status });
    }
}
