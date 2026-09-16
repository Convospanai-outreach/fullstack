import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { setTeamCrystalApiKey, clearTeamCrystalApiKey, verifyCrystalApiKey } from "@/modules/crystal-knows/crystalCredentials";

// Setup-time Crystal Knows API key for a team. Configuring a key enables lead
// personality enrichment and DISC-tuned AI drafting; leaving it unset skips
// those features entirely (best-effort, never blocks other enrichment).
export async function GET(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Credential-bearing integration settings are ADMIN-only across this
    // codebase (see whatsapp/settings/route.ts) - without this, any team
    // member could read or overwrite the team's Crystal API key.
    if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { crystalApiKeyEnc: true, crystalApiKeyConfiguredAt: true },
    });

    return NextResponse.json({
        hasKey: !!team?.crystalApiKeyEnc,
        configuredAt: team?.crystalApiKeyConfiguredAt || null,
    });
}

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (body?.hasKey === false) {
        await clearTeamCrystalApiKey(teamId);
        return NextResponse.json({ hasKey: false });
    }

    const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) {
        return NextResponse.json({ error: "apiKey is required." }, { status: 400 });
    }

    const verification = await verifyCrystalApiKey(apiKey);
    if (!verification.ok) {
        return NextResponse.json({ error: verification.reason || "Could not verify this Crystal API key." }, { status: 422 });
    }

    await setTeamCrystalApiKey(teamId, apiKey);
    return NextResponse.json({ hasKey: true });
}
