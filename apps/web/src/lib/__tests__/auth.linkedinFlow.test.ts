import { createRequire } from "module";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Drives NextAuth's real request handler (csrf -> signin -> callback) against a fake LinkedIn and an
// in-memory database. The unit tests cover linkedInSignIn's rules; this one covers what NextAuth
// itself does after that gate (which account it attaches the identity to, and what it saves), so
// a next-auth upgrade that changes that behaviour fails here.

type User = { id: string; email: string; name?: string | null; suspendedAt?: Date | null };
type Account = Record<string, unknown> & { userId: string; provider: string; providerAccountId: string };

const { db, requestCookies, mockCreateUser } = vi.hoisted(() => {
    process.env["LINKEDIN_LOGIN_ENABLED"] = "true";
    process.env["LINKEDIN_CLIENT_ID"] = "client-id";
    process.env["LINKEDIN_CLIENT_SECRET"] = "client-secret";
    process.env["GOOGLE_CLIENT_ID"] = "google-id";
    process.env["GOOGLE_CLIENT_SECRET"] = "google-secret";
    process.env["NEXTAUTH_URL"] = "https://app.test";
    process.env["NEXTAUTH_SECRET"] = "test-secret";
    return {
        db: { users: [] as User[], accounts: [] as Account[] },
        requestCookies: { current: {} as Record<string, string> },
        mockCreateUser: vi.fn(),
    };
});

const findUser = (where: { id?: string; email?: string }) =>
    db.users.find((user) => (where.id ? user.id === where.id : user.email === where.email)) ?? null;
const findAccount = (provider: string, providerAccountId: string) =>
    db.accounts.find((account) => account.provider === provider && account.providerAccountId === providerAccountId) ?? null;

vi.mock("@next-auth/prisma-adapter", () => ({
    PrismaAdapter: () => ({
        getUser: async (id: string) => findUser({ id }),
        getUserByEmail: async (email: string) => findUser({ email }),
        getUserByAccount: async (key: { provider: string; providerAccountId: string }) => {
            const account = findAccount(key.provider, key.providerAccountId);
            return account ? findUser({ id: account.userId }) : null;
        },
        createUser: mockCreateUser,
        linkAccount: async (account: Account) => void db.accounts.push(account),
    }),
}));
vi.mock("@/lib/db", () => ({
    prisma: {
        account: {
            findUnique: async ({ where }: any) => {
                const key = where.provider_providerAccountId;
                const account = findAccount(key.provider, key.providerAccountId);
                return account ? { user: findUser({ id: account.userId }) } : null;
            },
        },
        user: {
            findUnique: async ({ where }: any) => findUser(where),
            findFirst: async ({ where }: any) => db.users.find((user) => user.email.toLowerCase() === where.email.equals) ?? null,
        },
        teamMember: { findFirst: async () => null },
    },
}));
vi.mock("@/lib/googleOnboarding", () => ({
    syncGoogleUserToApp: async ({ email, name }: { email: string; name: string | null }) => {
        const user = { id: `user-${db.users.length + 1}`, email, name };
        db.users.push(user);
        return user;
    },
}));
vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: async () => false }));
vi.mock("@/lib/userAccess", () => ({
    forgetUserAccess: () => {},
    getUserAccess: async () => ({ suspended: false, sessionVersion: 0 }),
    sessionVersionMatches: () => true,
}));
vi.mock("@/lib/redis", () => ({ safeGet: async () => "FREE", safeSet: async () => {} }));
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name in requestCookies.current ? { name, value: requestCookies.current[name] } : undefined),
        getAll: () => Object.entries(requestCookies.current).map(([name, value]) => ({ name, value })),
    }),
}));

import { decode, encode } from "next-auth/jwt";
import { authOptions } from "../auth";

// The handler behind /api/auth/[...nextauth]. next-auth doesn't export it, and its route wrapper
// needs a running Next.js request, so it is loaded from the package folder.
const nodeRequire = createRequire(import.meta.url);
const { AuthHandler } = nodeRequire(path.join(path.dirname(nodeRequire.resolve("next-auth")), "core", "index.js")) as {
    AuthHandler: (params: { req: Record<string, unknown>; options: typeof authOptions }) => Promise<any>;
};

const SESSION_COOKIE = "__Secure-next-auth.session-token";
const fetchMock = vi.fn();
let linkedInProfile: Record<string, unknown>;

async function continueWithLinkedIn(options: { signedInAs?: string; tamperState?: boolean } = {}) {
    const jar: Record<string, string> = {};
    const keep = (cookies: Array<{ name: string; value: string }> | undefined) => {
        for (const cookie of cookies ?? []) jar[cookie.name] = cookie.value;
    };
    const call = (req: Record<string, unknown>) => {
        requestCookies.current = { ...jar };
        // The route wrapper is what normally fills in the secret from NEXTAUTH_SECRET.
        return AuthHandler({ req: { headers: {}, cookies: requestCookies.current, ...req }, options: { ...authOptions, secret: "test-secret" } });
    };

    if (options.signedInAs) jar[SESSION_COOKIE] = await encode({ token: { sub: options.signedInAs } as any, secret: "test-secret" });

    const csrf = await call({ action: "csrf", method: "GET" });
    keep(csrf.cookies);
    const signin = await call({
        action: "signin",
        providerId: "linkedin",
        method: "POST",
        body: { csrfToken: csrf.body.csrfToken, callbackUrl: "https://app.test/dashboard" },
    });
    keep(signin.cookies);
    const authorize = new URL(signin.redirect!);
    const state = authorize.searchParams.get("state")!;

    const callback = await call({
        action: "callback",
        providerId: "linkedin",
        method: "GET",
        query: { code: "code-1", state: options.tamperState ? `${state}x` : state },
    });
    const sessionCookie = callback.cookies?.find((cookie: { name: string; value: string }) => cookie.name === SESSION_COOKIE && cookie.value)?.value;
    const session = sessionCookie ? await decode({ token: sessionCookie, secret: "test-secret" }) : null;
    return { authorize, redirect: callback.redirect, signedInAs: (session?.sub as string | undefined) ?? null };
}

describe("Continue with LinkedIn through NextAuth", () => {
    beforeEach(() => {
        db.users.length = 0;
        db.accounts.length = 0;
        mockCreateUser.mockReset();
        fetchMock.mockReset();
        linkedInProfile = { sub: "li-sub", name: "Ada Lovelace", email: "ada@example.com", email_verified: true };
        fetchMock.mockImplementation(async (url: string) =>
            String(url).includes("/accessToken")
                ? new Response(JSON.stringify({ access_token: "at", id_token: "a.b.c", expires_in: 5184000, scope: "openid,profile,email" }))
                : new Response(JSON.stringify(linkedInProfile))
        );
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("sends the person to LinkedIn with the sign-in scopes and NextAuth's callback URL", async () => {
        const { authorize } = await continueWithLinkedIn();

        expect(authorize.origin + authorize.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
        expect(authorize.searchParams.get("scope")).toBe("openid profile email");
        expect(authorize.searchParams.get("redirect_uri")).toBe("https://app.test/api/auth/callback/linkedin");
        expect(authorize.searchParams.get("client_id")).toBe("client-id");
    });

    it("creates one account for a new person, connects LinkedIn to it and keeps no LinkedIn token", async () => {
        const result = await continueWithLinkedIn();

        expect(result.redirect).toBe("https://app.test/dashboard");
        expect(db.users).toEqual([{ id: "user-1", email: "ada@example.com", name: "Ada Lovelace" }]);
        expect(mockCreateUser).not.toHaveBeenCalled();
        expect(db.accounts).toEqual([{ userId: "user-1", type: "oauth", provider: "linkedin", providerAccountId: "li-sub" }]);
        expect(result.signedInAs).toBe("user-1");
    });

    it("signs a connected LinkedIn profile in to its account, even though the emails differ", async () => {
        db.users.push({ id: "owner", email: "owner@company.com" });
        db.accounts.push({ userId: "owner", type: "oauth", provider: "linkedin", providerAccountId: "li-sub" });

        const result = await continueWithLinkedIn();

        expect(result.redirect).toBe("https://app.test/dashboard");
        expect(result.signedInAs).toBe("owner");
        expect(db.users).toHaveLength(1);
        expect(db.accounts).toHaveLength(1);
    });

    it("turns away an unconnected LinkedIn profile whose email belongs to an existing account", async () => {
        db.users.push({ id: "owner", email: "Ada@Example.com" });

        const result = await continueWithLinkedIn();

        expect(result.redirect).toBe("/login?error=linkedin-not-connected");
        expect(result.signedInAs).toBeNull();
        expect(db.accounts).toEqual([]);
        expect(db.users).toHaveLength(1);
    });

    it("doesn't attach an unconnected LinkedIn profile to whoever is signed in, and creates nobody", async () => {
        db.users.push({ id: "user-7", email: "someone@else.com" });

        const result = await continueWithLinkedIn({ signedInAs: "user-7" });

        expect(result.redirect).toBe("/settings/general?linkedinLogin=not-connected");
        expect(db.accounts).toEqual([]);
        expect(db.users).toHaveLength(1);
    });

    it("turns away a LinkedIn profile with no verified email", async () => {
        linkedInProfile = { sub: "li-sub", name: "Ada Lovelace", email: "ada@example.com", email_verified: false };

        const result = await continueWithLinkedIn();

        expect(result.redirect).toBe("/login?error=linkedin-no-email");
        expect(db.users).toEqual([]);
        expect(db.accounts).toEqual([]);
    });

    it("stops before contacting LinkedIn when the returned state was altered", async () => {
        const result = await continueWithLinkedIn({ tamperState: true });

        expect(result.redirect).toContain("error=OAuthCallback");
        expect(result.signedInAs).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(db.users).toEqual([]);
    });
});
