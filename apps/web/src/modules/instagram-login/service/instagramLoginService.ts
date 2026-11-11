import crypto from "crypto";
import { prisma } from "@/lib/db";
import { encryptCredential } from "@/lib/security/credentialVault";
import { sanitizeRelativePath, signState, verifyState } from "@/modules/facebook-leads/service/facebookLeadsService";

// "Connect Instagram only": the Instagram API with Instagram Login (no Facebook Page). Flow and
// endpoints checked 2026-10-24 against
// https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
// https://developers.facebook.com/documentation/instagram-platform/webhooks/setup.md
// - Authorize at instagram.com/oauth/authorize; the redirect carries a single-use code (1 hour).
// - POST api.instagram.com/oauth/access_token swaps it for a short-lived Instagram User token (the
//   response is { data: [{ access_token, user_id, permissions }] }; a flat body is accepted too).
// - GET graph.instagram.com/access_token?grant_type=ig_exchange_token makes it a 60-day token. The
//   daily token check in apps/api refreshes it (socialTokenHealth.ts).
// - GET /me?fields=user_id,username: user_id is the Instagram professional account id and the
//   value webhooks send as entry.id, so it's the SocialAccount's externalId. The id in the token
//   response and /me "id" are app-scoped and don't match webhooks.
// - POST /{ig-id}/subscribed_apps?subscribed_fields=... turns on webhook delivery.
// The account is stored like the Facebook-connected ones except it has no parentExternalId, which
// is how apps/api tells the two apart (creator-funnel/instagramLogin.ts). Posting isn't requested.

const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const LONG_LIVED_URL = "https://graph.instagram.com/access_token";
const GRAPH_BASE_URL = "https://graph.instagram.com/v26.0";
const TIMEOUT_MS = 15_000;
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

export const INSTAGRAM_LOGIN_SCOPES = ["instagram_business_basic", "instagram_business_manage_comments", "instagram_business_manage_messages"];
const WEBHOOK_FIELD_FOR_SCOPE: Record<string, string> = {
    instagram_business_manage_comments: "comments",
    instagram_business_manage_messages: "messages",
};

function getInstagramConfig() {
    const appId = process.env["INSTAGRAM_APP_ID"];
    const appSecret = process.env["INSTAGRAM_APP_SECRET"];
    const redirectUri = process.env["INSTAGRAM_LOGIN_REDIRECT_URI"] || "https://craftmyfunnel.live/api/integrations/instagram/oauth/callback";
    if (!appId || !appSecret) {
        throw new Error("INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be configured.");
    }
    if (!process.env["INSTAGRAM_LOGIN_REDIRECT_URI"] && process.env["NODE_ENV"] === "production") {
        throw new Error("INSTAGRAM_LOGIN_REDIRECT_URI is not set — refusing to build an OAuth URL with an unverified fallback.");
    }
    return { appId, appSecret, redirectUri };
}

export function buildInstagramLoginAuthUrl(input: { teamId: string; userId: string; nextPath?: string }): string {
    const { appId, redirectUri } = getInstagramConfig();
    const state = signState({
        teamId: input.teamId,
        userId: input.userId,
        nextPath: sanitizeRelativePath(input.nextPath),
        purpose: "instagram",
        nonce: crypto.randomUUID(),
        ts: Date.now(),
    });
    const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        state,
        scope: INSTAGRAM_LOGIN_SCOPES.join(","),
        response_type: "code",
        force_reauth: "true", // so a person with several Instagram logins picks the right one
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
}

function errorMessage(json: any, fallback: string) {
    const message = json?.error_message || json?.error?.message || (typeof json?.error === "string" ? json.error : "");
    return String(message || fallback).slice(0, 300);
}

async function readJson(res: Response): Promise<any> {
    return res.json().catch(() => null);
}

export async function connectInstagramLogin(input: { code: string; state: string }) {
    const state = verifyState(input.state);
    if (state.purpose !== "instagram") throw new Error("Invalid OAuth state.");
    if (!Number.isFinite(state.ts) || Date.now() - state.ts > STATE_MAX_AGE_MS) throw new Error("This sign-in took too long. Try again.");
    const { appId, appSecret, redirectUri } = getInstagramConfig();

    // Instagram appends "#_" to the code in the redirect.
    const code = input.code.replace(/#_$/, "");
    const shortRes = await fetch(TOKEN_URL, {
        method: "POST",
        body: new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const shortJson = await readJson(shortRes);
    const short = Array.isArray(shortJson?.data) ? shortJson.data[0] : shortJson;
    if (!shortRes.ok || typeof short?.access_token !== "string") {
        throw new Error(errorMessage(shortJson, "Instagram sign-in failed."));
    }

    const longRes = await fetch(
        `${LONG_LIVED_URL}?` + new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: appSecret, access_token: short.access_token }),
        { signal: AbortSignal.timeout(TIMEOUT_MS) }
    );
    const longJson = await readJson(longRes);
    if (!longRes.ok || typeof longJson?.access_token !== "string") {
        throw new Error(errorMessage(longJson, "Instagram long-lived token exchange failed."));
    }
    const token: string = longJson.access_token;
    const seconds = Number(longJson.expires_in);
    const tokenExpiresAt = Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000) : null;

    const meRes = await fetch(`${GRAPH_BASE_URL}/me?` + new URLSearchParams({ fields: "user_id,username" }), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const me = await readJson(meRes);
    const accountId = me?.user_id ? String(me.user_id) : "";
    if (!meRes.ok || !accountId) throw new Error(errorMessage(me, "Couldn't read the Instagram account."));

    const permissions = short.permissions;
    const granted: string[] = (Array.isArray(permissions) ? permissions : typeof permissions === "string" ? permissions.split(",") : INSTAGRAM_LOGIN_SCOPES)
        .map((scope: string) => scope.trim())
        .filter(Boolean);
    if (!granted.includes("instagram_business_basic")) {
        throw new Error("Instagram didn't give CraftMyFunnel access to the account. Try again and allow the permissions.");
    }

    const handle = typeof me.username === "string" && me.username ? `@${me.username}` : null;
    const data = {
        handle,
        parentExternalId: null, // no Facebook Page: this is what marks an Instagram Login account
        encryptedToken: (await encryptCredential(token)) as any,
        scopes: granted,
        tokenExpiresAt,
        status: "CONNECTED",
        lastError: null,
        expiryWarnedAt: null,
        connectedById: state.userId,
    };
    const account = await prisma.socialAccount.upsert({
        where: { teamId_platform_externalId: { teamId: state.teamId, platform: "INSTAGRAM", externalId: accountId } },
        create: { teamId: state.teamId, platform: "INSTAGRAM", externalId: accountId, ...data },
        update: data,
        select: { id: true, platform: true, handle: true },
    });

    // Webhooks are optional: a failed subscription doesn't fail the connect, it's shown on the account.
    const fields = granted.map((scope) => WEBHOOK_FIELD_FOR_SCOPE[scope]).filter((field): field is string => Boolean(field));
    if (fields.length) {
        const problem = await subscribe(accountId, token, fields);
        if (problem) {
            await prisma.socialAccount.update({
                where: { id: account.id },
                data: { lastError: `Comments and messages from this account won't reach CMf: ${problem}` },
            });
        }
    }
    return { pages: [account], nextPath: state.nextPath, purpose: "social" as const };
}

// Returns Meta's error, or null on success.
async function subscribe(accountId: string, token: string, fields: string[]) {
    try {
        const res = await fetch(`${GRAPH_BASE_URL}/${encodeURIComponent(accountId)}/subscribed_apps`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: new URLSearchParams({ subscribed_fields: fields.join(",") }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const json = await readJson(res);
        if (res.ok && json?.success !== false) return null;
        return errorMessage(json, `Meta returned HTTP ${res.status}.`);
    } catch {
        return "Meta didn't answer in time.";
    }
}
