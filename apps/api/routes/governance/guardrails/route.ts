import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

// Client-editable fields only - notably excludes id/teamId (ownership must not
// be reassignable via the request body, matching the pattern in
// routes/schedules/[id]/route.ts) and createdAt/updatedAt.
const GUARDRAIL_PATCHABLE_FIELDS = [
    "blocklist",
    "allowlist",
    "regexRules",
    "competitorMentions",
    "maxDailyMsgs",
    "detectPII",
    "strictness",
] as const;

function pickPatchableFields(body: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    for (const key of GUARDRAIL_PATCHABLE_FIELDS) {
        if (key in body) data[key] = body[key];
    }
    return data;
}

export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });
        if (!teamId) return new NextResponse("Workspace Not Found", { status: 404 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { guardrailPolicy: true }
        });
        if (!team) {
            return new NextResponse("Workspace Not Found", { status: 404 });
        }

        let policy = team.guardrailPolicy;

        // Initialize if doesn't exist
        if (!policy) {
            policy = await prisma.guardrailPolicy.create({
                data: {
                    teamId: team.id,
                    blocklist: ["spam", "buy now", "winning"],
                    allowlist: [],
                    regexRules: [],
                    competitorMentions: [],
                }
            });
        }

        return NextResponse.json({ success: true, policy });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Governance API] Failed to fetch guardrails", { error: errorMessage });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, teamId } = await getCurrentContext();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });
        if (!teamId) return new NextResponse("Workspace Not Found", { status: 404 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const data = pickPatchableFields(body);

        const policy = await prisma.guardrailPolicy.upsert({
            where: { teamId },
            create: {
                teamId,
                ...data
            },
            update: data
        });

        return NextResponse.json({ success: true, policy });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Governance API] Failed to update guardrails", { error: errorMessage });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
