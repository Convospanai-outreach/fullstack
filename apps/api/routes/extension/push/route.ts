import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../_lib/auth";
import { PIIScrubber } from "@/lib/governance/PIIScrubber";
import { scrapeLinkedInProfile } from "@/linkedin/scraper-bridge";

function sanitizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, maxLength);
}

function sanitizeProfileText(value: unknown, maxLength: number, scrubPii: boolean = false): string | undefined {
    const base = sanitizeText(value, maxLength);
    if (!base) return undefined;
    return scrubPii ? PIIScrubber.scrub(base) : base;
}

export async function POST(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ ok: false, error: auth.error, code: auth.code }, { status: auth.status });
        }
        if (auth.teamIds.length === 0) {
            return NextResponse.json({ ok: false, error: "User has no team membership", code: "NO_TEAM_MEMBERSHIP" }, { status: 403 });
        }

        const body = await req.json();
        const requestedTeamId = sanitizeText(body.teamId, 120);
        const resolvedTeamId = requestedTeamId
            ? (auth.teamIds.includes(requestedTeamId) ? requestedTeamId : null)
            : (auth.teamIds.length === 1 ? auth.teamIds[0] : null);

        if (!resolvedTeamId) {
            return NextResponse.json(
                { ok: false, error: "teamId is required for multi-team users", code: "TEAM_ID_REQUIRED" },
                { status: 400 }
            );
        }

        const name = sanitizeProfileText(body.name, 200);
        const headline = sanitizeProfileText(body.headline, 200);
        const about = sanitizeProfileText(body.about, 4000, true);
        const location = sanitizeProfileText(body.location, 140);
        if (!body.url) {
            return NextResponse.json(
                { ok: false, error: "Valid LinkedIn profile url is required", code: "INVALID_LINKEDIN_URL" },
                { status: 400 }
            );
        }

        try {
            await scrapeLinkedInProfile({
                url: body.url,
                name,
                headline,
                about,
                location,
                teamId: resolvedTeamId,
                userId: auth.user.id
            });
        } catch (e: any) {
            if (e.message === "Invalid LinkedIn URL") {
                return NextResponse.json(
                    { ok: false, error: "Valid LinkedIn profile url is required", code: "INVALID_LINKEDIN_URL" },
                    { status: 400 }
                );
            }
            throw e;
        }

        return NextResponse.json({ ok: true, message: "Profile saved" });
    } catch (error: any) {
        console.error("[Extension Push] Error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
