import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setTeamWaba, clearTeamWaba, verifyWabaCredentials } from "@/modules/whatsapp/wabaCredentials";

// Setup-time WABA (WhatsApp Business API) ownership for a team. Configuring
// credentials here enables automated sequence sends; leaving it unset (or
// explicitly clearing it) keeps WhatsApp sequence steps human-in-the-loop -
// each one creates a Task for a rep instead of sending automatically.
export async function GET(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { whatsappPhoneNumberId: true, whatsappWabaConfiguredAt: true },
    });

    return NextResponse.json({
        hasWaba: !!team?.whatsappPhoneNumberId,
        phoneNumberId: team?.whatsappPhoneNumberId || null,
        configuredAt: team?.whatsappWabaConfiguredAt || null,
    });
}

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    if (!phoneNumberId || !accessToken) {
        return NextResponse.json({ error: "phoneNumberId and accessToken are required." }, { status: 400 });
    }

    const verification = await verifyWabaCredentials(phoneNumberId, accessToken);
    if (!verification.ok) {
        return NextResponse.json({ error: verification.reason || "Could not verify WhatsApp credentials." }, { status: 422 });
    }

    await setTeamWaba(teamId, phoneNumberId, accessToken);
    return NextResponse.json({ hasWaba: true, phoneNumberId });
}
