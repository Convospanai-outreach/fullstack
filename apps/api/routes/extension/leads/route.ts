import { NextRequest, NextResponse } from "next/server";
import { LeadService } from "@/services/LeadService";
import { validateExtensionAuth } from "../_lib/auth";
import { resolveExtensionTeamScope } from "../_lib/teamScope";
import { canonicalLinkedInProfileUrl } from "@/lib/crm/linkedin";
import { queueCaptureEnrichment } from "@/services/extensionLeadCaptureService";

function sanitizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim().replace(/\s+/g, " ");
    return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export async function POST(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ ok: false, error: auth.error, code: auth.code }, { status: auth.status });
        }

        const body = await req.json().catch(() => ({}));
        const requestedTeamId = sanitizeText(body.teamId, 120) || req.headers.get("x-team-id");
        const teamScope = resolveExtensionTeamScope(auth.teamIds, requestedTeamId);
        if (!teamScope.ok) {
            return NextResponse.json({ ok: false, error: teamScope.error, code: teamScope.code }, { status: teamScope.status });
        }

        const profileUrl = canonicalLinkedInProfileUrl(body.profileUrl || body.url);
        if (!profileUrl) {
            return NextResponse.json(
                { ok: false, error: "Valid LinkedIn profile URL is required", code: "INVALID_LINKEDIN_URL" },
                { status: 400 }
            );
        }

        const lead = await LeadService.upsert(teamScope.teamId, auth.user.id, {
            fullName: sanitizeText(body.name, 200) || null,
            linkedIn: profileUrl,
            company: sanitizeText(body.company, 200) || null,
            jobTitle: sanitizeText(body.headline || body.designation, 240) || null,
            status: "NEW",
            pipelineState: "COLD",
            enrichedData: {
                source: "linkedin_extension",
                capturedAt: new Date().toISOString(),
                headline: sanitizeText(body.headline || body.designation, 240) || null
            }
        });

        const enrichmentQueued = await queueCaptureEnrichment(teamScope.teamId, lead);

        return NextResponse.json({ ok: true, lead, enrichmentQueued });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal error";
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}
