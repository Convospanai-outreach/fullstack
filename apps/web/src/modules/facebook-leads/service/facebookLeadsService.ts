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

export function buildFacebookLeadsAuthUrl(input: { teamId: string; userId: string; nextPath?: string; purpose?: FacebookConnectPurpose }): string {
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
        scope: (purpose === "social" ? FACEBOOK_SOCIAL_SCOPES : FACEBOOK_LEAD_SCOPES).join(","),
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
        const accounts = await connectSocialAccounts(statePayload, longLivedJson.access_token, pages);
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

// One FACEBOOK_PAGE account per Page, plus an INSTAGRAM account for each Page with a linked
// Instagram professional account. Instagram calls with Facebook Login use the Page's token.
async function connectSocialAccounts(state: OAuthStatePayload, userToken: string, pages: Array<{ id: string; name?: string; access_token: string }>) {
    const scopes = await grantedScopes(userToken);
    const upsert = async (platform: "FACEBOOK_PAGE" | "INSTAGRAM", externalId: string, handle: string | null, parentExternalId: string | null, token: unknown) => {
        const data = {
            handle,
            parentExternalId,
            encryptedToken: token as any,
            scopes,
            tokenExpiresAt: null,
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
        accounts.push(await upsert("FACEBOOK_PAGE", page.id, page.name ?? null, null, token));

        // GET /{page-id}?fields=instagram_business_account (Instagram API with Facebook Login, get started)
        const igRes = await fetch(
            `${SOCIAL_GRAPH_BASE_URL}/${encodeURIComponent(page.id)}?` +
                new URLSearchParams({ fields: "instagram_business_account{id,username}", access_token: page.access_token })
        );
        const igJson: any = await igRes.json();
        const ig = igRes.ok ? igJson?.instagram_business_account : null;
        if (ig?.id) {
            accounts.push(await upsert("INSTAGRAM", String(ig.id), ig.username ? `@${ig.username}` : null, page.id, token));
        }
    }
    return accounts;
}
