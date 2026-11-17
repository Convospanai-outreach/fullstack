import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { setTeamWaba, verifyWabaAccount, verifyWabaCredentials } from "@/modules/whatsapp/wabaCredentials";
import { exchangeSignupCode, getEmbeddedSignupConfig, subscribeAppToWaba } from "@/modules/whatsapp/embeddedSignup";

// Finishes Meta's Embedded Signup for a team: the browser sends the one-time code and the ids the
// signup popup returned; we turn the code into the team's own WhatsApp access token, check it, point
// WhatsApp at our webhook and store it the same way the manual form does. Admin-only like /whatsapp/settings.
const ID_PATTERN = /^\d{5,30}$/;

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const config = getEmbeddedSignupConfig();
    if (!config) {
        return NextResponse.json({ error: "Connecting WhatsApp with one click is not available yet." }, { status: 503 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const phoneNumberId = typeof body?.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
    const wabaId = typeof body?.wabaId === "string" ? body.wabaId.trim() : "";
    if (!code || code.length > 2000 || !ID_PATTERN.test(phoneNumberId) || !ID_PATTERN.test(wabaId)) {
        return NextResponse.json({ error: "code, phoneNumberId and wabaId are required." }, { status: 400 });
    }

    // The webhook finds a team by its phone number id, so one number can only belong to one team.
    const taken = await prisma.team.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId, NOT: { id: teamId } },
        select: { id: true },
    });
    if (taken) {
        return NextResponse.json({ error: "This WhatsApp number is already connected to another workspace." }, { status: 409 });
    }

    const exchange = await exchangeSignupCode(code, config);
    if (!exchange.ok) {
        return NextResponse.json({ error: exchange.reason }, { status: 422 });
    }

    const credentials = await verifyWabaCredentials(phoneNumberId, exchange.accessToken);
    if (!credentials.ok) {
        return NextResponse.json({ error: credentials.reason || "Could not verify WhatsApp credentials." }, { status: 422 });
    }
    const account = await verifyWabaAccount(wabaId, exchange.accessToken);
    if (!account.ok) {
        return NextResponse.json({ error: account.reason || "Could not verify the WhatsApp Business Account." }, { status: 422 });
    }
    const subscription = await subscribeAppToWaba(wabaId, exchange.accessToken);
    if (!subscription.ok) {
        return NextResponse.json({ error: subscription.reason || "Could not subscribe the account to our webhook." }, { status: 422 });
    }

    await setTeamWaba(teamId, phoneNumberId, exchange.accessToken, wabaId);
    return NextResponse.json({ hasWaba: true, phoneNumberId, businessAccountId: wabaId });
}
