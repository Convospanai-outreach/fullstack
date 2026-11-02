import { logger } from "@/lib/logger";
import { GRAPH_VERSION } from "@/modules/whatsapp/wabaCredentials";

// Meta's Embedded Signup lets a customer connect their own WhatsApp Business Account from a popup
// instead of pasting ids and a token. It only works once our Meta app is an approved Tech Provider and
// has an Embedded Signup configuration, so it stays off until all three settings below exist.
export type EmbeddedSignupConfig = { appId: string; configId: string; appSecret: string };

export function getEmbeddedSignupConfig(): EmbeddedSignupConfig | null {
    const appId = process.env["WHATSAPP_APP_ID"]?.trim();
    const configId = process.env["WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID"]?.trim();
    const appSecret = process.env["WHATSAPP_APP_SECRET"]?.trim();
    return appId && configId && appSecret ? { appId, configId, appSecret } : null;
}

type Result<T> = ({ ok: true } & T) | { ok: false; reason: string };

/** Trades the one-time code from the signup popup for the customer's business access token. */
export async function exchangeSignupCode(code: string, config: EmbeddedSignupConfig): Promise<Result<{ accessToken: string }>> {
    try {
        const query = new URLSearchParams({ client_id: config.appId, client_secret: config.appSecret, code });
        const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${query.toString()}`, {
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
            // Never log the URL, token or body: they carry the app secret and credential material.
            logger.warn(`[WABA] Signup code exchange failed with status ${response.status}`);
            return { ok: false, reason: "WhatsApp did not accept the signup. Try connecting again." };
        }
        const json: any = await response.json();
        const accessToken = typeof json?.access_token === "string" ? json.access_token : "";
        if (!accessToken) return { ok: false, reason: "WhatsApp did not return an access token. Try connecting again." };
        return { ok: true, accessToken };
    } catch (error: any) {
        logger.warn(`[WABA] Signup code exchange errored: ${error?.name === "TimeoutError" ? "timeout" : "network error"}`);
        return { ok: false, reason: "Could not reach WhatsApp to finish the signup." };
    }
}

/** Subscribes our app to the customer's WhatsApp account so its messages reach /webhooks/whatsapp. */
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<{ ok: boolean; reason?: string }> {
    try {
        const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(wabaId)}/subscribed_apps`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
            logger.warn(`[WABA] Webhook subscription failed with status ${response.status}`);
            return { ok: false, reason: `WhatsApp would not subscribe this account to our webhook (status ${response.status}).` };
        }
        return { ok: true };
    } catch (error: any) {
        logger.warn(`[WABA] Webhook subscription errored: ${error?.name === "TimeoutError" ? "timeout" : "network error"}`);
        return { ok: false, reason: "Could not reach WhatsApp to subscribe the account to our webhook." };
    }
}
