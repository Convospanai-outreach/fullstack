import { NextRequest, NextResponse } from "next/server";
import { validateExtensionAuth } from "../../../_lib/auth";
import { resolveExtensionTeamScope } from "../../../_lib/teamScope";
import { markLinkedInOutreachDone } from "@/services/extensionLeadCaptureService";

function sanitizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim().replace(/\s+/g, " ");
    return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ success: false, error: auth.error, code: auth.code }, { status: auth.status });
        }

        const body = await req.json().catch(() => ({}));
        const requestedTeamId = sanitizeText(body.teamId, 120) || req.headers.get("x-team-id");
        const teamScope = resolveExtensionTeamScope(auth.teamIds, requestedTeamId);
        if (!teamScope.ok) {
            return NextResponse.json({ success: false, error: teamScope.error, code: teamScope.code }, { status: teamScope.status });
        }

        const { id } = await params;
        const result = await markLinkedInOutreachDone({
            teamId: teamScope.teamId,
            userId: auth.user.id,
            leadId: id,
            notes: sanitizeText(body.notes, 4000)
        });

        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal error";
        const status = message === "Lead not found" ? 404 : 500;
        return NextResponse.json({ success: false, error: message }, { status });
    }
}
