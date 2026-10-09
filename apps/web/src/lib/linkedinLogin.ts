import crypto from "crypto";
import { cookies } from "next/headers";
import { getToken } from "next-auth/jwt";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { prisma } from "@/lib/db";
import { isSsoEnforcedForEmail } from "@/lib/sso/oidc";
import { syncGoogleUserToApp } from "@/lib/googleOnboarding";

// "Continue with LinkedIn" as a way to sign in. It has its own LinkedIn app
// (LINKEDIN_LOGIN_CLIENT_ID/SECRET, setup in docs/linkedin-api-access.md) and is off until those
// are set. It must not share the creator-funnel apps: LinkedIn invalidates a member's earlier
// access tokens for an app when the same app asks that member for a different scope, so signing
// in through the posting app would disconnect the member's saved posting token.
//
// A LinkedIn identity signs in only when it is already connected to an account (an Account row,
// provider "linkedin"), or when its verified email belongs to nobody yet, which creates a new
// account the way a Google signup does. It is never attached to an existing account by email:
// the owner signs in the usual way and connects it under Settings > General.
//
// NextAuth's bundled LinkedIn provider calls retired endpoints, and LinkedIn's token response
// carries an id_token, which NextAuth's plain OAuth path rejects, so the token and userinfo
// calls are made here. Checked 2026-10-09:
// https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
// (scopes openid profile email; GET /v2/userinfo -> sub, name, picture, email, email_verified;
// email and email_verified are optional; sub is per app)
// https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
// ("If you request a different scope than the previously granted scope, all the previous access
// tokens are invalidated."), which is also why sign-in and Settings connect ask for the same scope.

const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const TIMEOUT_MS = 15_000;
const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const SCOPE = "openid profile email";
const CONNECT_CALLBACK_PATH = "/api/profile/linkedin-login/callback";

// After the usual sign-in the person lands on the Settings page where LinkedIn is connected.
export const LINKEDIN_NOT_CONNECTED = "/login?error=linkedin-not-connected&callbackUrl=%2Fsettings%2Fgeneral";
export const LINKEDIN_NO_EMAIL = "/login?error=linkedin-no-email";
// For someone already signed in: NextAuth would attach the identity to that session by itself.
export const LINKEDIN_CONNECT_IN_SETTINGS = "/settings/general?linkedinLogin=not-connected";

export type LinkedInProfile = { sub: string; name?: string; picture?: string; email?: string; email_verified?: boolean };

type ConnectState = { userId: string; nonce: string; ts: number };

export class LinkedInLoginError extends Error {}

function client() {
    const clientId = process.env["LINKEDIN_LOGIN_CLIENT_ID"];
    const clientSecret = process.env["LINKEDIN_LOGIN_CLIENT_SECRET"];
    const baseUrl = process.env["NEXTAUTH_URL"];
    if (!clientId || !clientSecret || !baseUrl) return null;
    return { clientId, clientSecret, baseUrl: baseUrl.replace(/\/+$/, "") };
}

export function linkedInLoginEnabled(): boolean {
    return client() !== null;
}

async function exchangeCode(code: string, redirectUri: string): Promise<string> {
    const config = client();
    if (!config) throw new LinkedInLoginError("LinkedIn sign-in isn't set up on this server.");
    let res: Response;
    try {
        res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                client_id: config.clientId,
                client_secret: config.clientSecret,
                redirect_uri: redirectUri,
            }),
            redirect: "error",
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        throw new LinkedInLoginError("LinkedIn didn't answer in time. Try again.");
    }
    const json: any = await res.json().catch(() => null);
    if (!res.ok || typeof json?.access_token !== "string") {
        throw new LinkedInLoginError("LinkedIn didn't accept the sign-in. Try again.");
    }
    return json.access_token;
}

async function fetchProfile(accessToken: string | undefined): Promise<LinkedInProfile> {
    let res: Response;
    try {
        res = await fetch(USERINFO_URL, {
            headers: { Authorization: `Bearer ${accessToken}` },
            redirect: "error",
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        throw new LinkedInLoginError("LinkedIn didn't answer in time. Try again.");
    }
    const json: any = await res.json().catch(() => null);
    if (!res.ok) throw new LinkedInLoginError(`LinkedIn returned HTTP ${res.status}.`);
    if (typeof json?.sub !== "string" || !json.sub) throw new LinkedInLoginError("LinkedIn didn't say which profile signed in.");
    return json;
}

/** The NextAuth provider, or null while LinkedIn sign-in is off. */
export function linkedInLoginProvider(): OAuthConfig<LinkedInProfile> | null {
    const config = client();
    if (!config) return null;
    return {
        id: "linkedin",
        name: "LinkedIn",
        type: "oauth",
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authorization: { url: AUTHORIZE_URL, params: { scope: SCOPE } },
        checks: ["state"],
        token: {
            url: TOKEN_URL,
            async request({ params, checks, provider }) {
                // A custom request replaces NextAuth's own handling of the callback, state check included.
                if (!params.state || params.state !== checks.state) throw new LinkedInLoginError("LinkedIn sign-in state didn't match.");
                if (!params.code) throw new LinkedInLoginError("LinkedIn didn't send a sign-in code.");
                return { tokens: { access_token: await exchangeCode(params.code, provider.callbackUrl) } };
            },
        },
        userinfo: { url: USERINFO_URL, request: ({ tokens }) => fetchProfile(tokens.access_token) },
        profile: (profile) => ({
            id: profile.sub,
            name: profile.name ?? null,
            email: profile.email?.toLowerCase() ?? null,
            image: profile.picture ?? null,
        }),
        // linkedInSignIn below is the only gate. NextAuth looks the email up again after it, so
        // without this it refuses the account that gate has just created.
        allowDangerousEmailAccountLinking: true,
    };
}

/** The user this browser is signed in as, read the way NextAuth's callback reads it. */
async function signedInUserId(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = await getToken({ req: { cookies: cookieStore, headers: {} } as any });
    if (!token?.sub) return null;
    const user = await prisma.user.findUnique({ where: { id: token.sub }, select: { id: true } });
    return user?.id ?? null;
}

/** The sign-in decision for a LinkedIn identity: true, or the page that explains the refusal. */
export async function linkedInSignIn(providerAccountId: string, profile: Partial<LinkedInProfile> | undefined): Promise<true | string> {
    const connected = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider: "linkedin", providerAccountId } },
        select: { user: { select: { email: true, suspendedAt: true } } },
    });
    if (connected) {
        // The account's own email decides SSO; LinkedIn's can differ and plays no part here.
        if (connected.user.suspendedAt) return "/login?error=suspended";
        if (connected.user.email && (await isSsoEnforcedForEmail(connected.user.email))) return "/login?error=sso-required";
        return true;
    }

    if (await signedInUserId()) return LINKEDIN_CONNECT_IN_SETTINGS;

    const email = profile?.email?.trim().toLowerCase();
    if (!email || profile?.email_verified !== true) return LINKEDIN_NO_EMAIL;

    // Case-insensitive, so an older mixed-case row counts as the existing account it is.
    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (existing) return LINKEDIN_NOT_CONNECTED;

    const inviteToken = (await cookies()).get("cmf-invite-token")?.value;
    const created = await syncGoogleUserToApp({ email, name: profile.name || null, inviteToken });
    // Only SSO enforcement on the email's domain denies a brand-new signup.
    return created ? true : "/login?error=sso-required";
}

function stateSecret() {
    const secret = process.env["NEXTAUTH_SECRET"];
    if (!secret) throw new LinkedInLoginError("NEXTAUTH_SECRET is required for LinkedIn sign-in.");
    return secret;
}

// The prefix keeps this state apart from the creator-funnel LinkedIn state signed with the same secret.
function stateSignature(body: string) {
    return crypto.createHmac("sha256", stateSecret()).update(`linkedin-login.${body}`).digest("base64url");
}

/** The verified state of a Settings "Connect LinkedIn" round-trip, or null when it's forged, malformed or stale. */
export function verifyLinkedInLoginState(state: string | null, now = Date.now()): ConnectState | null {
    if (!state) return null;
    const [body, sig] = state.split(".");
    if (!body || !sig) return null;
    const expected = Buffer.from(stateSignature(body));
    const given = Buffer.from(sig);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ConnectState;
        if (!payload?.userId) return null;
        if (typeof payload.ts !== "number" || now - payload.ts > STATE_MAX_AGE_MS || payload.ts > now + 60_000) return null;
        return payload;
    } catch {
        return null;
    }
}

function connectRedirectUri(baseUrl: string) {
    return `${baseUrl}${CONNECT_CALLBACK_PATH}`;
}

/** Where to send a signed-in user who clicked "Connect LinkedIn" in Settings. */
export function buildLinkedInLoginConnectUrl(userId: string): string {
    const config = client();
    if (!config) throw new LinkedInLoginError("LinkedIn sign-in isn't set up on this server.");
    const body = Buffer.from(JSON.stringify({ userId, nonce: crypto.randomUUID(), ts: Date.now() } satisfies ConnectState)).toString("base64url");
    const params = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: connectRedirectUri(config.baseUrl),
        state: `${body}.${stateSignature(body)}`,
        scope: SCOPE,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function linkedInLoginConnected(userId: string): Promise<boolean> {
    return (await prisma.account.findFirst({ where: { userId, provider: "linkedin" }, select: { id: true } })) !== null;
}

/** Finishes "Connect LinkedIn": from now on this LinkedIn profile signs in as this user. No LinkedIn token is kept. */
export async function connectLinkedInLogin(input: { code: string; userId: string }): Promise<void> {
    const config = client();
    if (!config) throw new LinkedInLoginError("LinkedIn sign-in isn't set up on this server.");
    const { sub } = await fetchProfile(await exchangeCode(input.code, connectRedirectUri(config.baseUrl)));

    const [owner, own] = await Promise.all([
        prisma.account.findUnique({
            where: { provider_providerAccountId: { provider: "linkedin", providerAccountId: sub } },
            select: { userId: true },
        }),
        prisma.account.findFirst({ where: { userId: input.userId, provider: "linkedin" }, select: { providerAccountId: true } }),
    ]);
    if (owner && owner.userId !== input.userId) {
        throw new LinkedInLoginError("That LinkedIn profile already signs in to a different CraftMyFunnel account.");
    }
    if (own && own.providerAccountId !== sub) {
        throw new LinkedInLoginError("A different LinkedIn profile is already connected to your account.");
    }
    if (owner) return;
    await prisma.account.create({ data: { userId: input.userId, type: "oauth", provider: "linkedin", providerAccountId: sub } });
}
