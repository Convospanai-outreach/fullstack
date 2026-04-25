import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/governance/audit";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

export async function GET() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkTeamPermission(userId, teamId, TeamRole.MEMBER)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    try {
        const policy = await prisma.guardrailPolicy.findUnique({
            where: { teamId }
        });
        return NextResponse.json(policy || {});
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { blocklist, allowlist, regexRules, competitorMentions, detectPII, strictness } = body;

        const policy = await prisma.guardrailPolicy.upsert({
            where: { teamId },
            update: {
                blocklist,
                allowlist,
                regexRules,
                competitorMentions,
                detectPII,
                strictness: strictness || 'medium'
            },
            create: {
                teamId,
                blocklist: blocklist || [],
                allowlist: allowlist || [],
                regexRules: regexRules || [],
                competitorMentions: competitorMentions || [],
                detectPII: detectPII ?? true,
                strictness: strictness || 'medium'
            }
        });

        await audit({
            actorId: userId,
            orgId: teamId,
            action: "UPDATE_GUARDRAILS",
            entity: "GuardrailPolicy",
            entityId: policy.id,
            metadata: { strictness, pii: detectPII }
        });

        return NextResponse.json(policy);
    } catch (error: any) {
        console.error("[Guardrail API] PUT error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
