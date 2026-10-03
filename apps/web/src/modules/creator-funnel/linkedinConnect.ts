import crypto from "crypto";
import { prisma } from "@/lib/db";
import { encryptCredential } from "@/lib/security/credentialVault";

// Creator funnel "Connect LinkedIn" (phase 7). Two LinkedIn apps, because LinkedIn only grants
// the Community Management API (company pages) to an app that has no other product:
// - "profile": Share on LinkedIn + Sign In with LinkedIn using OpenID Connect (self-serve),
//   scopes openid profile w_member_social. One LINKEDIN_MEMBER row, externalId urn:li:person:{sub}.
// - "pages": Community Management API (LinkedIn must approve it), scopes w_organization_social
//   rw_organization_admin. One LINKEDIN_ORG row per Page the member administers. Off unless the
//   platform switch `linkedin_pages` is on and LINKEDIN_PAGES_CLIENT_ID/SECRET are set.
// OpenID subject ids are pairwise (per app), so a pages-app row never links to a profile-app row.
//
// Checked 2026-10-04:
// - https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
//   (authorization + accessToken endpoints; access tokens last 60 days; programmatic refresh
//   tokens are for a limited set of partners, so people reconnect; codes live 30 minutes)
// - https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
//   (openid/profile/w_member_social are open permissions)
// - https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
//   (GET /v2/userinfo -> sub, name; subject_types_supported: pairwise)
// - https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role
//   (GET /rest/organizationAcls?q=roleAssignee; the org field is "organization" in one sample
//   and "organizationTarget" in another, so both are read)
// - https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-lookup-api
//   (GET /rest/organizationsLookup?ids=List(...) -> localizedName, no admin role needed)
// - https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
//   (w_organization_social posts for ADMINISTRATOR, DIRECT_SPONSORED_CONTENT_POSTER, CONTENT_ADMIN)
// - Community Management API must be the only product on its app (Development tier):
//   https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview

const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API_BASE = "https://api.linkedin.com";
// Versioned (/rest) APIs need a YYYYMM version; each one is retired about a year after release
// (202510 sunsets 2026-10-15), so bump this, and the copy in apps/api linkedinApi.ts, yearly.
const LINKEDIN_VERSION = "202609";
const TIMEOUT_MS = 15_000;
const STATE_MAX_AGE_MS = 30 * 60 * 1000;
const NEXT_PATH = "/settings/social";
const ACL_PAGE_SIZE = 100;
const ACL_MAX_PAGES = 10; // a safety cap; 1000 page roles is far beyond any real member
const PAGE_ROLES = new Set(["ADMINISTRATOR", "CONTENT_ADMINISTRATOR", "CONTENT_ADMIN", "DIRECT_SPONSORED_CONTENT_POSTER"]);

export const LINKEDIN_PAGES_SWITCH = "linkedin_pages";

export type LinkedInConnectKind = "profile" | "pages";

const SCOPES: Record<LinkedInConnectKind, string[]> = {
    profile: ["openid", "profile", "w_member_social"],
    pages: ["w_organization_social", "rw_organization_admin"],
};

type StatePayload = { teamId: string; userId: string; kind: LinkedInConnectKind; nonce: string; ts: number };

export class LinkedInConnectError extends Error {}

function clientFor(kind: LinkedInConnectKind) {
    const prefix = kind === "pages" ? "LINKEDIN_PAGES" : "LINKEDIN";
    const clientId = process.env[`${prefix}_CLIENT_ID`];
    const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
}

function redirectUri() {
    const configured = process.env["LINKEDIN_REDIRECT_URI"];
    if (!configured && process.env["NODE_ENV"] === "production") {
        throw new LinkedInConnectError("LINKEDIN_REDIRECT_URI is not set.");
    }
    return configured || "https://craftmyfunnel.live/api/integrations/linkedin/oauth/callback";
}

/** Whether this kind of LinkedIn connection can be started here (app configured, and the pages switch on for pages). */
export async function linkedInAvailable(kind: LinkedInConnectKind): Promise<boolean> {
    if (!clientFor(kind)) return false;
    if (!process.env["LINKEDIN_REDIRECT_URI"] && process.env["NODE_ENV"] === "production") return false;
    if (kind === "profile") return true;
    const row = await prisma.featureFlag.findUnique({ where: { key: LINKEDIN_PAGES_SWITCH }, select: { isEnabled: true } });
    return row?.isEnabled === true;
}

function stateSecret() {
    const secret = process.env["NEXTAUTH_SECRET"] || process.env["ENCRYPTION_KEY"];
    if (!secret) throw new LinkedInConnectError("NEXTAUTH_SECRET or ENCRYPTION_KEY is required for LinkedIn sign-in.");
    return secret;
}

function signState(payload: StatePayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url")}`;
}

/** The verified state, or null when it's forged, malformed or older than the code it came with. */
export function verifyLinkedInState(state: string | null, now = Date.now()): StatePayload | null {
    if (!state) return null;
    const [body, sig] = state.split(".");
    if (!body || !sig) return null;
    const expected = Buffer.from(crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url"));
    const given = Buffer.from(sig);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
        if (!payload?.teamId || !payload.userId || (payload.kind !== "profile" && payload.kind !== "pages")) return null;
        if (typeof payload.ts !== "number" || now - payload.ts > STATE_MAX_AGE_MS || payload.ts > now + 60_000) return null;
        return payload;
    } catch {
        return null;
    }
}

export function buildLinkedInAuthUrl(input: { teamId: string; userId: string; kind: LinkedInConnectKind }): string {
    const client = clientFor(input.kind);
    if (!client) throw new LinkedInConnectError("LinkedIn isn't set up on this server.");
    const state = signState({ teamId: input.teamId, userId: input.userId, kind: input.kind, nonce: crypto.randomUUID(), ts: Date.now() });
    const params = new URLSearchParams({
        response_type: "code",
        client_id: client.clientId,
        redirect_uri: redirectUri(),
        state,
        scope: SCOPES[input.kind].join(" "),
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
}

/** LinkedIn documents a space-delimited list but has returned commas, so accept both. */
export function parseScopes(value: unknown): string[] {
    return typeof value === "string" ? value.split(/[\s,]+/).filter(Boolean) : [];
}

async function linkedInGet(path: string, token: string, versioned: boolean): Promise<any> {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                ...(versioned ? { "LinkedIn-Version": LINKEDIN_VERSION, "X-Restli-Protocol-Version": "2.0.0" } : {}),
            },
            redirect: "error",
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        throw new LinkedInConnectError("LinkedIn didn't answer in time. Try again.");
    }
    const json: any = await res.json().catch(() => null);
    if (!res.ok) throw new LinkedInConnectError(`LinkedIn returned HTTP ${res.status}.`);
    return json;
}

async function exchangeCode(kind: LinkedInConnectKind, code: string) {
    const client = clientFor(kind);
    if (!client) throw new LinkedInConnectError("LinkedIn isn't set up on this server.");
    let res: Response;
    try {
        res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                client_id: client.clientId,
                client_secret: client.clientSecret,
                redirect_uri: redirectUri(),
            }),
            redirect: "error",
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        throw new LinkedInConnectError("LinkedIn didn't answer in time. Try again.");
    }
    const json: any = await res.json().catch(() => null);
    if (!res.ok || typeof json?.access_token !== "string") {
        throw new LinkedInConnectError("LinkedIn didn't accept the sign-in. Try again.");
    }
    const expiresIn = typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : null;
    // Members consent to every requested scope or none, so a response without "scope" means all of them.
    const granted = parseScopes(json.scope);
    return {
        accessToken: json.access_token as string,
        scopes: granted.length ? granted : SCOPES[kind],
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    };
}

async function upsertAccount(
    state: StatePayload,
    platform: "LINKEDIN_MEMBER" | "LINKEDIN_ORG",
    externalId: string,
    handle: string | null,
    token: unknown,
    scopes: string[],
    tokenExpiresAt: Date | null
) {
    const data = {
        handle,
        parentExternalId: null,
        encryptedToken: token as any,
        scopes,
        tokenExpiresAt,
        status: "CONNECTED",
        lastError: null,
        expiryWarnedAt: null,
        lastCheckedAt: null,
        connectedById: state.userId,
    };
    return prisma.socialAccount.upsert({
        where: { teamId_platform_externalId: { teamId: state.teamId, platform, externalId } },
        create: { teamId: state.teamId, platform, externalId, ...data },
        update: data,
        select: { id: true },
    });
}

async function administeredPages(token: string): Promise<Array<{ urn: string; name: string | null }>> {
    const urns = new Set<string>();
    for (let start = 0; start < ACL_PAGE_SIZE * ACL_MAX_PAGES; start += ACL_PAGE_SIZE) {
        const acls = await linkedInGet(`/rest/organizationAcls?q=roleAssignee&state=APPROVED&count=${ACL_PAGE_SIZE}&start=${start}`, token, true);
        const elements: any[] = Array.isArray(acls?.elements) ? acls.elements : [];
        for (const el of elements) {
            const urn = typeof el?.organization === "string" ? el.organization : el?.organizationTarget;
            if (typeof urn === "string" && /^urn:li:organization:\d+$/.test(urn) && PAGE_ROLES.has(el?.role)) urns.add(urn);
        }
        if (elements.length < ACL_PAGE_SIZE) break;
    }
    if (urns.size === 0) return [];
    const ids = [...urns].map((urn) => urn.slice("urn:li:organization:".length));
    const names = new Map<string, string>();
    try {
        const lookup = await linkedInGet(`/rest/organizationsLookup?ids=List(${ids.join(",")})`, token, true);
        for (const [id, org] of Object.entries<any>(lookup?.results ?? {})) {
            if (typeof org?.localizedName === "string") names.set(id, org.localizedName);
        }
    } catch {
        // Names are cosmetic; the page still connects and shows as "LinkedIn page".
    }
    return ids.map((id) => ({ urn: `urn:li:organization:${id}`, name: names.get(id) ?? null }));
}

/** Finishes the sign-in: saves the profile, or each Page the member can post to. Returns how many accounts were connected. */
export async function connectLinkedIn(input: { code: string; state: StatePayload }): Promise<number> {
    const { state } = input;
    const token = await exchangeCode(state.kind, input.code);
    const encrypted = await encryptCredential(token.accessToken);

    if (state.kind === "profile") {
        const me = await linkedInGet("/v2/userinfo", token.accessToken, false);
        if (typeof me?.sub !== "string" || !me.sub) throw new LinkedInConnectError("LinkedIn didn't say which profile signed in.");
        const name = typeof me.name === "string" && me.name.trim() ? me.name.trim() : null;
        await upsertAccount(state, "LINKEDIN_MEMBER", `urn:li:person:${me.sub}`, name, encrypted, token.scopes, token.expiresAt);
        return 1;
    }

    const pages = await administeredPages(token.accessToken);
    for (const page of pages) {
        await upsertAccount(state, "LINKEDIN_ORG", page.urn, page.name, encrypted, token.scopes, token.expiresAt);
    }
    return pages.length;
}
