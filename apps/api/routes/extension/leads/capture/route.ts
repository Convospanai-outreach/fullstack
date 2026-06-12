import { NextRequest, NextResponse } from "next/server";
import { validateExtensionAuth } from "../../_lib/auth";
import { resolveExtensionTeamScope } from "../../_lib/teamScope";
import { normalizeLinkedInProfileUrl, syncLinkedInExtensionCapture } from "@/services/extensionLeadCaptureService";

function sanitizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim().replace(/\s+/g, " ");
    return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export async function POST(req: NextRequest) {
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

        const linkedinUrl = normalizeLinkedInProfileUrl(body.linkedinUrl || body.profileUrl);
        if (!linkedinUrl) {
            return NextResponse.json(
                { success: false, error: "Valid LinkedIn profile URL is required", code: "INVALID_LINKEDIN_URL" },
                { status: 400 }
            );
        }

        const result = await syncLinkedInExtensionCapture({
            teamId: teamScope.teamId,
            userId: auth.user.id,
            payload: { ...body, linkedinUrl }
        });

        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
