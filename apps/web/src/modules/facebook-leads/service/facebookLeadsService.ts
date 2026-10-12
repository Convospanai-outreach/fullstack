import crypto from "crypto";
import { prisma } from "@/lib/db";
import { encryptCredential } from "@/lib/security/credentialVault";

// Facebook/Instagram Lead Ads connect flow (no Zapier). This only stores a Page
// access token per connected Page - it does NOT pull leads itself. Leads are
// pulled by apps/api's facebook-leads-worker on a ~5h poll (see worker-manager.ts),
// via /{page_id}/leadgen_forms -> /{form_id}/leads, which is the actual Lead Ads
// delivery API. The Meta pixel is unrelated conversion tracking and plays no part
// in this flow.
const GRAPH_API_VERSION = "v21.0"; // re-verify this is still a supported version at deploy time
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const FACEBOOK_OAUTH_URL = "https://www.facebook.com/" + GRAPH_API_VERSION + "/dialog/oauth";
const MAX_ACCOUNT_PAGES = 200; // safety cap against a runaway/malformed paging loop

// leads_retrieval is the permission that actually gates reading Lead Ads leads;
// the rest are needed to enumerate the team's pages and their access tokens.
const FACEBOOK_LEAD_SCOPES = [
    "pages_show_list",
    "pages_manage_metadata",
    "pages_read_engagement",
    "leads_retrieval",
];

// Creator funnel "Connect Instagram / Facebook Page" (purpose "social"): the same OAuth flow,
// asking for posting, comment and messaging permissions instead of leads_retrieval, and
// writing SocialAccount rows instead of FacebookLeadSource. Names and dependencies checked
// 2026-09-30 against:
// - https://developers.facebook.com/docs/permissions
// - https://developers.facebook.com/documentation/instagram-platform/content-publishing.md
// - https://developers.facebook.com/documentation/instagram-platform/comment-moderation.md
// - https://developers.facebook.com/docs/messenger-platform/instagram/get-started
const FACEBOOK_SOCIAL_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_read_user_content",
    "pages_manage_metadata", // webhook subscriptions (DMs, comments)
    "pages_manage_posts",
    "pages_manage_engagement", // reply to Page comments
    "pages_messaging",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_messages",
];

// Meta: when the person's Page role comes through Business Manager, the app also needs these
// (https://developers.facebook.com/documentation/instagram-platform/content-publishing.md,
// Access Levels > Permissions, checked 2026-10-11). Only asked for on the separate Business
// Manager connect button, so the default connect (and its App Review submission) is unchanged.
const FACEBOOK_BUSINESS_MANAGER_SCOPES = ["ads_management", "ads_read"];

// Social calls use the current Graph API version. v21.0 above (Lead Ads) is supported until
// 2027-01-21 (https://developers.facebook.com/docs/graph-api/changelog/versions, checked 2026-09-30).
const SOCIAL_GRAPH_BASE_URL = "https://graph.facebook.com/v26.0";

export type FacebookConnectPurpose = "leads" | "social";

type OAuthStatePayload = {
    teamId: string;
    userId: string;
    nextPath?: string;
    purpose?: FacebookConnectPurpose;
    nonce: string;
    ts: number;
};

function getFacebookConfig() {
    const appId = process.env["FACEBOOK_APP_ID"];
    const appSecret = process.env["FACEBOOK_APP_SECRET"];
    const redirectUri =
        process.env["FACEBOOK_LEADS_REDIRECT_URI"] ||
        "https://craftmyfunnel.live/api/integrations/facebook/oauth/callback";

    if (!appId || !appSecret) {
        throw new Error("FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be configured.");
    }
    if (!process.env["FACEBOOK_LEADS_REDIRECT_URI"] && process.env["NODE_ENV"] === "production") {
        throw new Error("FACEBOOK_LEADS_REDIRECT_URI is not set — refusing to build an OAuth URL with an unverified fallback.");
    }
    return { appId, appSecret, redirectUri };
}

// Same sanitize/sign/verify state pattern as googleMailboxService.ts - mirrored,
// not imported, per this repo's established precedent of duplication over
// cross-module coupling between independent OAuth-connect flows.
// No dedicated /settings/integrations page exists yet in this app - falls back
// to /settings/crm, the closest existing settings page for external-integration
// connect flows, until a Facebook-specific settings UI is built.
function sanitizeRelativePath(path?: string | null) {
    if (!path || !path.startsWith("/") || path.startsWith("//")) return "/settings/crm";
    try {
        const parsed = new URL(path, "https://app.local");
        if (parsed.origin !== "https://app.local") return "/settings/crm";
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return "/settings/crm";
    }
}

function getStateSecret(): string | undefined {
    return process.env["NEXTAUTH_SECRET"] || process.env["ENCRYPTION_KEY"];
}

function signState(payload: OAuthStatePayload): string {
    const secret = getStateSecret();
    if (!secret) throw new Error("NEXTAUTH_SECRET or ENCRYPTION_KEY is required for Facebook OAuth state signing.");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
}

function verifyState(state: string): OAuthStatePayload {
    const secret = getStateSecret();
    if (!secret) throw new Error("NEXTAUTH_SECRET or ENCRYPTION_KEY is required for Facebook OAuth state verification.");
    const [body, sig] = state.split(".");
    if (!body || !sig) throw new Error("Invalid OAuth state.");
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        throw new Error("Invalid OAuth state signature.");
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!payload || typeof payload !== "object" || !payload.teamId || !payload.userId) {
        throw new Error("Invalid OAuth state structure.");
    }
    return payload;
}

/** Where a failed callback should send the user: the verified state's nextPath, if any. */
export function nextPathFromState(state: string | null): string | null {
    if (!state) return null;
    try {
        return verifyState(state).nextPath ?? null;
    } catch {
        return null;
    }
}

export function buildFacebookLeadsAuthUrl(input: { teamId: string; userId: string; nextPath?: string; purpose?: FacebookConnectPurpose; businessManager?: boolean }): string {
    const { appId, redirectUri } = getFacebookConfig();
    const purpose = input.purpose ?? "leads";
    const state = signState({
        teamId: input.teamId,
        userId: input.userId,
        nextPath: sanitizeRelativePath(input.nextPath),
        purpose,
        nonce: crypto.randomUUID(),
        ts: Date.now(),
    });

    const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        state,
        scope: (purpose === "social"
            ? [...FACEBOOK_SOCIAL_SCOPES, ...(input.businessManager ? FACEBOOK_BUSINESS_MANAGER_SCOPES : [])]
            : FACEBOOK_LEAD_SCOPES
        ).join(","),
        response_type: "code",
    });
    return `${FACEBOOK_OAUTH_URL}?${params.toString()}`;
}

export async function connectFacebookPages(input: { code: string; state: string }) {
    const statePayload = verifyState(input.state);
    const { appId, appSecret, redirectUri } = getFacebookConfig();

    const tokenRes = await fetch(
        `${GRAPH_BASE_URL}/oauth/access_token?` +
            new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, client_secret: appSecret, code: input.code })
    );
    const tokenJson: any = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
        throw new Error(tokenJson?.error?.message || "Facebook token exchange failed.");
    }

    // Exchange the short-lived user token for a long-lived one (~60 days) so the
    // page tokens derived from it (below) don't expire every couple of hours.
    const longLivedRes = await fetch(
        `${GRAPH_BASE_URL}/oauth/access_token?` +
            new URLSearchParams({
                grant_type: "fb_exchange_token",
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: tokenJson.access_token,
            })
    );
    const longLivedJson: any = await longLivedRes.json();
    if (!longLivedRes.ok || !longLivedJson.access_token) {
        throw new Error(longLivedJson?.error?.message || "Facebook long-lived token exchange failed.");
    }

    // /me/accounts returns a page access token per page, already long-lived when
    // derived from a long-lived user token - no further exchange needed per page.
    // Paginated (default page size 25) - follows `paging.next` until exhausted so
    // an account managing more than one page's worth of Pages doesn't silently
    // connect only the first 25 (capped at MAX_ACCOUNT_PAGES as a guard against a
    // malformed/looping paging response).
    const pages: Array<{ id: string; name?: string; access_token: string }> = [];
    let accountsUrl = `${GRAPH_BASE_URL}/me/accounts?` + new URLSearchParams({ access_token: longLivedJson.access_token });
    let pageCount = 0;
    while (accountsUrl && pageCount < MAX_ACCOUNT_PAGES) {
        const pagesRes = await fetch(accountsUrl);
        const pagesJson: any = await pagesRes.json();
        if (!pagesRes.ok) {
            throw new Error(pagesJson?.error?.message || "Unable to list Facebook Pages.");
        }
        pages.push(...(pagesJson?.data || []));
        accountsUrl = pagesJson?.paging?.next || "";
        pageCount += 1;
    }
    if (pages.length === 0) {
        throw new Error("No Facebook Pages found for this account. Connect a Page you manage.");
    }

    if (statePayload.purpose === "social") {
        const expiresIn = Number(longLivedJson.expires_in);
        const userTokenExpiresAt = Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;
        const accounts = await connectSocialAccounts(statePayload, longLivedJson.access_token, userTokenExpiresAt, pages);
        return { pages: accounts, nextPath: statePayload.nextPath, purpose: "social" as const };
    }

    const connected = [];
    for (const page of pages) {
        const encryptedPageAccessToken = await encryptCredential(page.access_token);
        const source = await prisma.facebookLeadSource.upsert({
            where: { teamId_pageId: { teamId: statePayload.teamId, pageId: page.id } },
            create: {
                teamId: statePayload.teamId,
                pageId: page.id,
                pageName: page.name ?? null,
                encryptedPageAccessToken: encryptedPageAccessToken as any,
                isActive: true,
            },
            update: {
                pageName: page.name ?? null,
                encryptedPageAccessToken: encryptedPageAccessToken as any,
                isActive: true,
                lastError: null,
            },
        });
        connected.push(source);
    }

    return { pages: connected, nextPath: statePayload.nextPath, purpose: "leads" as const };
}

async function grantedScopes(userToken: string) {
    // GET /me/permissions -> { data: [{ permission, status: "granted" | "declined" | "expired" }] }
    // (https://developers.facebook.com/docs/graph-api/reference/user/permissions/, checked 2026-09-30)
    const res = await fetch(`${SOCIAL_GRAPH_BASE_URL}/me/permissions?` + new URLSearchParams({ access_token: userToken }));
    const json: any = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || "Unable to read granted Facebook permissions.");
    return (json?.data || []).filter((row: any) => row?.status === "granted").map((row: any) => String(row.permission));
}

// Subscribes the app to the Page's messages and feed, so its Messenger conversations, its
// linked Instagram account's DMs and its post comments (keyword auto-replies) reach apps/api's
// /webhooks/meta-social: POST /{page-id}/subscribed_apps with subscribed_fields=messages,feed and
// the Page token (needs pages_manage_metadata; Instagram subscribes "through the linked Facebook
// Page"). The call replaces the app's field list, so both fields go every time. Checked 2026-10-01:
// https://developers.facebook.com/documentation/business-messaging/messenger-platform/webhooks
// https://developers.facebook.com/docs/graph-api/webhooks/reference/page/ (feed: comments)
// Returns Meta's error, or null on success.
async function subscribePageToMessages(pageId: string, pageToken: string) {
    try {
        const res = await fetch(`${SOCIAL_GRAPH_BASE_URL}/${encodeURIComponent(pageId)}/subscribed_apps`, {
            method: "POST",
            body: new URLSearchParams({ subscribed_fields: "messages,feed", access_token: pageToken }),
            signal: AbortSignal.timeout(15_000),
        });
        const json: any = await res.json().catch(() => null);
        if (res.ok && json?.success !== false) return null;
        return String(json?.error?.message || `Meta returned HTTP ${res.status}.`).slice(0, 300);
    } catch {
        return "Meta didn't answer in time.";
    }
}

// One FACEBOOK_PAGE account per Page (with the Page's token, which doesn't expire), plus an
// INSTAGRAM account for each Page with a linked Instagram professional account. Instagram
// account rows hold the long-lived User token instead: the Instagram API with Facebook Login
// lists "Access Tokens | User" for POST/GET /{ig-user-id}/media
// (https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media,
// checked 2026-10-01). A long-lived User token "generally lasts about 60 days" and isn't
// refreshed server-side (https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived,
// checked 2026-10-01), so the daily token check warns before it expires and the person reconnects.
async function connectSocialAccounts(
    state: OAuthStatePayload,
    userToken: string,
    userTokenExpiresAt: Date | null,
    pages: Array<{ id: string; name?: string; access_token: string }>
) {
    const scopes = await grantedScopes(userToken);
    const encryptedUserToken = await encryptCredential(userToken);
    const upsert = async (
        platform: "FACEBOOK_PAGE" | "INSTAGRAM",
        externalId: string,
        handle: string | null,
        parentExternalId: string | null,
        token: unknown,
        tokenExpiresAt: Date | null
    ) => {
        const data = {
            handle,
            parentExternalId,
            encryptedToken: token as any,
            scopes,
            tokenExpiresAt,
            status: "CONNECTED",
            lastError: null,
            expiryWarnedAt: null,
            connectedById: state.userId,
        };
        return prisma.socialAccount.upsert({
            where: { teamId_platform_externalId: { teamId: state.teamId, platform, externalId } },
            create: { teamId: state.teamId, platform, externalId, ...data },
            update: data,
            select: { id: true, platform: true, handle: true },
        });
    };

    const accounts = [];
    for (const page of pages) {
        const token = await encryptCredential(page.access_token);
        const pageAccount = await upsert("FACEBOOK_PAGE", page.id, page.name ?? null, null, token, null);
        accounts.push(pageAccount);

        // DMs are optional: a failed subscription doesn't fail the connect, it's shown on the account.
        if (scopes.includes("pages_manage_metadata")) {
            const subscribeError = await subscribePageToMessages(page.id, page.access_token);
            if (subscribeError) {
                await prisma.socialAccount.update({
                    where: { id: pageAccount.id },
                    data: { lastError: `Messages and comments from this Page and its Instagram account won't reach CMf: ${subscribeError}` },
                });
            }
        }

        // GET /{page-id}?fields=instagram_business_account (Instagram API with Facebook Login, get started)
        const igRes = await fetch(
            `${SOCIAL_GRAPH_BASE_URL}/${encodeURIComponent(page.id)}?` +
                new URLSearchParams({ fields: "instagram_business_account{id,username}", access_token: page.access_token })
        );
        const igJson: any = await igRes.json();
        const ig = igRes.ok ? igJson?.instagram_business_account : null;
        if (ig?.id) {
            accounts.push(await upsert("INSTAGRAM", String(ig.id), ig.username ? `@${ig.username}` : null, page.id, encryptedUserToken, userTokenExpiresAt));
        }
    }
    return accounts;
}
