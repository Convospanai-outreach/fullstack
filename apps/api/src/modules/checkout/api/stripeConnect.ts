import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { APIError, handleAPIError, successResponse } from "@/lib/apiResponse";
import { getStripeConnectAuthorizeUrl, exchangeStripeOAuthCode } from "../gateways/stripeConnect";
import { createStripeConnectState, consumeStripeConnectState } from "../gateways/oauthState";
import { paymentAccountService } from "../service/paymentAccountService";

export async function startConnect() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            throw new APIError("Unauthorized", 401);
        }
        await authorizeRole(userId, teamId, TeamRole.ADMIN);

        const state = await createStripeConnectState(teamId, userId);
        const url = getStripeConnectAuthorizeUrl(state);
        return successResponse({ url });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function callback(req: Request) {
    const appOrigin = process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000";
    const settingsUrl = `${appOrigin}/settings/payments`;

    try {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
            throw new APIError("Missing code or state", 400);
        }

        const { teamId } = await consumeStripeConnectState(state);
        const { stripeUserId } = await exchangeStripeOAuthCode(code);

        await paymentAccountService.upsert(teamId, "STRIPE", {
            externalAccountId: stripeUserId,
            status: "ACTIVE",
        });

        return NextResponse.redirect(`${settingsUrl}?stripe=connected`);
    } catch (error) {
        console.error("[Stripe Connect Callback]", error);
        return NextResponse.redirect(`${settingsUrl}?stripe=error`);
    }
}
