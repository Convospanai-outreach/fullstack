import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { setTeamWaba, clearTeamWaba, verifyWabaAccount, verifyWabaCredentials } from "@/modules/whatsapp/wabaCredentials";

// Setup-time WABA (WhatsApp Business API) ownership for a team. Configuring
// credentials here enables automated sequence sends; leaving it unset (or
// explicitly clearing it) keeps WhatsApp sequence steps human-in-the-loop -
// each one creates a Task for a rep instead of sending automatically.
export async function GET(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Credential-bearing integration settings are ADMIN-only across this
    // codebase (see smtp/config/route.ts) - without this, any team member
    // could read or, worse, overwrite the team's WhatsApp sending credentials.
    if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { whatsappPhoneNumberId: true, whatsappBusinessAccountId: true, whatsappWabaConfiguredAt: true },
    });

    return NextResponse.json({
        hasWaba: !!team?.whatsappPhoneNumberId,
        phoneNumberId: team?.whatsappPhoneNumberId || null,
        businessAccountId: team?.whatsappBusinessAccountId || null,
        configuredAt: team?.whatsappWabaConfiguredAt || null,
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

    if (body?.hasWaba === false) {
        await clearTeamWaba(teamId);
        return NextResponse.json({ hasWaba: false, phoneNumberId: null });
    }

    const phoneNumberId = typeof body?.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
    const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
    // Optional: the WhatsApp Business Account id, needed for template messages in sequences.
    const businessAccountId = typeof body?.businessAccountId === "string" ? body.businessAccountId.trim() : "";
    if (!phoneNumberId || !accessToken) {
        return NextResponse.json({ error: "phoneNumberId and accessToken are required." }, { status: 400 });
    }
    if (businessAccountId && !/^\d{5,30}$/.test(businessAccountId)) {
        return NextResponse.json({ error: "The WhatsApp Business Account ID is a number." }, { status: 400 });
    }

    const verification = await verifyWabaCredentials(phoneNumberId, accessToken);
    if (!verification.ok) {
        return NextResponse.json({ error: verification.reason || "Could not verify WhatsApp credentials." }, { status: 422 });
    }
    if (businessAccountId) {
        const account = await verifyWabaAccount(businessAccountId, accessToken);
        if (!account.ok) {
            return NextResponse.json({ error: account.reason || "Could not verify the WhatsApp Business Account ID." }, { status: 422 });
        }
    }

    await setTeamWaba(teamId, phoneNumberId, accessToken, businessAccountId || null);
    return NextResponse.json({ hasWaba: true, phoneNumberId, businessAccountId: businessAccountId || null });
}
