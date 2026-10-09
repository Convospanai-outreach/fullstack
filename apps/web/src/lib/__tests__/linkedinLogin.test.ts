import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockIsSsoEnforcedForEmail, mockSyncGoogleUserToApp, mockCookies, mockGetToken } = vi.hoisted(() => {
    process.env["LINKEDIN_LOGIN_CLIENT_ID"] = "client-id";
    process.env["LINKEDIN_LOGIN_CLIENT_SECRET"] = "client-secret";
    process.env["NEXTAUTH_URL"] = "https://app.test/";
    process.env["NEXTAUTH_SECRET"] = "test-secret";
    return {
        mockPrisma: {
            account: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
            user: { findUnique: vi.fn(), findFirst: vi.fn() },
        },
        mockIsSsoEnforcedForEmail: vi.fn(),
        mockSyncGoogleUserToApp: vi.fn(),
        mockCookies: vi.fn(),
        mockGetToken: vi.fn(),
    };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: mockIsSsoEnforcedForEmail }));
vi.mock("@/lib/googleOnboarding", () => ({ syncGoogleUserToApp: mockSyncGoogleUserToApp }));
vi.mock("next/headers", () => ({ cookies: mockCookies }));
vi.mock("next-auth/jwt", () => ({ getToken: mockGetToken }));

import {
    buildLinkedInLoginConnectUrl,
    connectLinkedInLogin,
    LINKEDIN_CONNECT_IN_SETTINGS,
    LINKEDIN_NO_EMAIL,
    LINKEDIN_NOT_CONNECTED,
    linkedInLoginEnabled,
    linkedInLoginProvider,
    linkedInSignIn,
    verifyLinkedInLoginState,
} from "../linkedinLogin";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const verified = { sub: "li-sub", name: "Ada Lovelace", email: "ada@example.com", email_verified: true };

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined), getAll: vi.fn().mockReturnValue([]) });
    mockGetToken.mockResolvedValue(null);
    mockIsSsoEnforcedForEmail.mockResolvedValue(false);
    mockPrisma.account.findUnique.mockResolvedValue(null);
    mockPrisma.account.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
});

describe("linkedInSignIn - a LinkedIn profile already connected to an account", () => {
    it("signs in, looked up by LinkedIn's subject id and never by email", async () => {
        mockPrisma.account.findUnique.mockResolvedValue({ user: { email: "owner@company.com", suspendedAt: null } });

        expect(await linkedInSignIn("li-sub", verified)).toBe(true);

        expect(mockPrisma.account.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { provider_providerAccountId: { provider: "linkedin", providerAccountId: "li-sub" } } })
        );
        expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
        expect(mockSyncGoogleUserToApp).not.toHaveBeenCalled();
    });

    it("signs in even when LinkedIn shares no email", async () => {
        mockPrisma.account.findUnique.mockResolvedValue({ user: { email: "owner@company.com", suspendedAt: null } });
        expect(await linkedInSignIn("li-sub", { sub: "li-sub" })).toBe(true);
    });

    it("refuses a suspended account", async () => {
        mockPrisma.account.findUnique.mockResolvedValue({ user: { email: "owner@company.com", suspendedAt: new Date() } });
        expect(await linkedInSignIn("li-sub", verified)).toBe("/login?error=suspended");
    });

    it("refuses when the account's own email is under enforced SSO, whatever email LinkedIn has", async () => {
        mockPrisma.account.findUnique.mockResolvedValue({ user: { email: "owner@company.com", suspendedAt: null } });
        mockIsSsoEnforcedForEmail.mockResolvedValue(true);

        expect(await linkedInSignIn("li-sub", verified)).toBe("/login?error=sso-required");
        expect(mockIsSsoEnforcedForEmail).toHaveBeenCalledWith("owner@company.com");
    });
});

describe("linkedInSignIn - a LinkedIn profile not connected to any account", () => {
    it("is refused, and never attached, when its email belongs to an existing account", async () => {
        mockPrisma.user.findFirst.mockResolvedValue({ id: "user-1" });

        expect(await linkedInSignIn("li-sub", verified)).toBe(LINKEDIN_NOT_CONNECTED);

        expect(mockSyncGoogleUserToApp).not.toHaveBeenCalled();
        expect(mockPrisma.account.create).not.toHaveBeenCalled();
    });

    it("matches the existing account whatever the letter case, so no duplicate is created", async () => {
        mockPrisma.user.findFirst.mockResolvedValue({ id: "user-1" });

        expect(await linkedInSignIn("li-sub", { ...verified, email: " Ada@Example.COM " })).toBe(LINKEDIN_NOT_CONNECTED);

        expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { email: { equals: "ada@example.com", mode: "insensitive" } } })
        );
        expect(mockSyncGoogleUserToApp).not.toHaveBeenCalled();
    });

    it("is sent to Settings when someone is already signed in, before any account is created", async () => {
        mockGetToken.mockResolvedValue({ sub: "user-7" });
        mockPrisma.user.findUnique.mockResolvedValue({ id: "user-7" });

        expect(await linkedInSignIn("li-sub", verified)).toBe(LINKEDIN_CONNECT_IN_SETTINGS);

        expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
        expect(mockSyncGoogleUserToApp).not.toHaveBeenCalled();
    });

    it("ignores a leftover session whose user no longer exists", async () => {
        mockGetToken.mockResolvedValue({ sub: "deleted-user" });
        mockSyncGoogleUserToApp.mockResolvedValue({ id: "new-user" });

        expect(await linkedInSignIn("li-sub", verified)).toBe(true);
    });

    it("creates a new account and team for a verified email nobody has, carrying the invite token", async () => {
        mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: "invite-123" }), getAll: vi.fn().mockReturnValue([]) });
        mockSyncGoogleUserToApp.mockResolvedValue({ id: "new-user" });

        expect(await linkedInSignIn("li-sub", { ...verified, email: "Ada@Example.com" })).toBe(true);

        expect(mockSyncGoogleUserToApp).toHaveBeenCalledWith({ email: "ada@example.com", name: "Ada Lovelace", inviteToken: "invite-123" });
    });

    it.each([
        ["no email", { sub: "li-sub", email_verified: true }],
        ["an unverified email", { ...verified, email_verified: false }],
        ["no verification flag", { sub: "li-sub", email: "ada@example.com" }],
        ["no profile at all", undefined],
    ])("is refused with %s, without looking anyone up by email", async (_label, profile) => {
        expect(await linkedInSignIn("li-sub", profile)).toBe(LINKEDIN_NO_EMAIL);

        expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
        expect(mockSyncGoogleUserToApp).not.toHaveBeenCalled();
    });

    it("is refused when the new email's domain is under enforced SSO", async () => {
        mockSyncGoogleUserToApp.mockResolvedValue(null);
        expect(await linkedInSignIn("li-sub", verified)).toBe("/login?error=sso-required");
    });
});

describe("linkedInLoginProvider", () => {
    const provider = linkedInLoginProvider()!;
    const tokenRequest = (provider.token as any).request as (ctx: any) => Promise<{ tokens: Record<string, unknown> }>;
    const userinfoRequest = (provider.userinfo as any).request as (ctx: any) => Promise<unknown>;
    const ctx = (params: Record<string, string>, state = "s1") => ({
        params,
        checks: { state },
        provider: { callbackUrl: "https://app.test/api/auth/callback/linkedin" },
    });

    it("is off unless its own LinkedIn app's keys are set, and never borrows the posting app's", () => {
        expect(linkedInLoginEnabled()).toBe(true);
        process.env["LINKEDIN_CLIENT_ID"] = "posting-id";
        process.env["LINKEDIN_CLIENT_SECRET"] = "posting-secret";
        for (const key of ["LINKEDIN_LOGIN_CLIENT_ID", "LINKEDIN_LOGIN_CLIENT_SECRET", "NEXTAUTH_URL"]) {
            const saved = process.env[key];
            delete process.env[key];
            expect(linkedInLoginProvider()).toBeNull();
            expect(linkedInLoginEnabled()).toBe(false);
            process.env[key] = saved;
        }
        delete process.env["LINKEDIN_CLIENT_ID"];
        delete process.env["LINKEDIN_CLIENT_SECRET"];
    });

    it("refuses a callback whose state doesn't match, before contacting LinkedIn", async () => {
        await expect(tokenRequest(ctx({ code: "c", state: "other" }))).rejects.toThrow(/state/);
        await expect(tokenRequest(ctx({ code: "c" }))).rejects.toThrow(/state/);
        await expect(tokenRequest({ ...ctx({ code: "c" }), checks: {} })).rejects.toThrow(/state/);
        await expect(tokenRequest(ctx({ state: "s1", error: "user_cancelled_login" }))).rejects.toThrow(/code/);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("exchanges the code and hands NextAuth the access token only", async () => {
        fetchMock.mockResolvedValue(json({ access_token: "at", id_token: "jwt", expires_in: 5184000, scope: "openid,profile,email" }));

        const result = await tokenRequest(ctx({ code: "c", state: "s1" }));

        expect(result).toEqual({ tokens: { access_token: "at" } });
        const [url, init] = fetchMock.mock.calls[0]!;
        expect(url).toBe("https://www.linkedin.com/oauth/v2/accessToken");
        expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
            grant_type: "authorization_code",
            code: "c",
            client_id: "client-id",
            client_secret: "client-secret",
            redirect_uri: "https://app.test/api/auth/callback/linkedin",
        });
    });

    it("fails when LinkedIn rejects the code", async () => {
        fetchMock.mockResolvedValue(json({ error: "invalid_request" }, 400));
        await expect(tokenRequest(ctx({ code: "c", state: "s1" }))).rejects.toThrow(/didn't accept/);
    });

    it("reads the profile from /v2/userinfo and needs a subject id", async () => {
        fetchMock.mockResolvedValueOnce(json(verified));
        expect(await userinfoRequest({ tokens: { access_token: "at" } })).toEqual(verified);
        expect(fetchMock.mock.calls[0]![0]).toBe("https://api.linkedin.com/v2/userinfo");
        expect(fetchMock.mock.calls[0]![1].headers).toEqual({ Authorization: "Bearer at" });

        fetchMock.mockResolvedValueOnce(json({ name: "No Subject" }));
        await expect(userinfoRequest({ tokens: { access_token: "at" } })).rejects.toThrow(/which profile/);
        fetchMock.mockResolvedValueOnce(json({}, 401));
        await expect(userinfoRequest({ tokens: { access_token: "at" } })).rejects.toThrow(/HTTP 401/);
    });

    it("asks for the sign-in scopes, checks state, and maps the profile with a lowercased email", async () => {
        expect(provider.authorization).toEqual({ url: "https://www.linkedin.com/oauth/v2/authorization", params: { scope: "openid profile email" } });
        expect(provider.checks).toEqual(["state"]);
        expect(await provider.profile({ sub: "li-sub", name: "Ada", email: "Ada@Example.com", picture: "p.png" }, {} as any)).toEqual({
            id: "li-sub",
            name: "Ada",
            email: "ada@example.com",
            image: "p.png",
        });
    });
});

describe("Connect LinkedIn from Settings", () => {
    const stateOf = (url: string) => new URL(url).searchParams.get("state")!;

    it("builds a LinkedIn URL whose state names the signed-in user", () => {
        const url = new URL(buildLinkedInLoginConnectUrl("user-1"));

        expect(url.origin + url.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
        expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/api/profile/linkedin-login/callback");
        // The same scope as sign-in: a different one would invalidate the other's grant.
        expect(url.searchParams.get("scope")).toBe("openid profile email");
        expect(url.searchParams.get("client_id")).toBe("client-id");
        expect(verifyLinkedInLoginState(url.searchParams.get("state"))?.userId).toBe("user-1");
    });

    it("rejects a missing, altered, stale or foreign state", () => {
        const state = stateOf(buildLinkedInLoginConnectUrl("user-1"));
        const [body, sig] = state.split(".") as [string, string];
        const forgedBody = Buffer.from(JSON.stringify({ userId: "user-2", nonce: "n", ts: Date.now() })).toString("base64url");
        // Signed with the same secret the creator-funnel LinkedIn connect uses, without this flow's prefix.
        const foreign = `${body}.${crypto.createHmac("sha256", "test-secret").update(body).digest("base64url")}`;

        expect(verifyLinkedInLoginState(null)).toBeNull();
        expect(verifyLinkedInLoginState("garbage")).toBeNull();
        expect(verifyLinkedInLoginState(`${forgedBody}.${sig}`)).toBeNull();
        expect(verifyLinkedInLoginState(foreign)).toBeNull();
        expect(verifyLinkedInLoginState(state, Date.now() + 11 * 60 * 1000)).toBeNull();
        expect(verifyLinkedInLoginState(state, Date.now() + 9 * 60 * 1000)?.userId).toBe("user-1");
    });

    const linkedInAnswers = () => {
        fetchMock.mockResolvedValueOnce(json({ access_token: "at" })).mockResolvedValueOnce(json({ sub: "li-sub", name: "Ada" }));
    };

    it("saves the connection with no LinkedIn token", async () => {
        linkedInAnswers();

        await connectLinkedInLogin({ code: "c", userId: "user-1" });

        expect((fetchMock.mock.calls[0]![1].body as URLSearchParams).get("redirect_uri")).toBe("https://app.test/api/profile/linkedin-login/callback");
        expect(mockPrisma.account.create).toHaveBeenCalledWith({
            data: { userId: "user-1", type: "oauth", provider: "linkedin", providerAccountId: "li-sub" },
        });
    });

    it("refuses a LinkedIn profile that already signs in to someone else's account", async () => {
        linkedInAnswers();
        mockPrisma.account.findUnique.mockResolvedValue({ userId: "user-2" });

        await expect(connectLinkedInLogin({ code: "c", userId: "user-1" })).rejects.toThrow(/different CraftMyFunnel account/);
        expect(mockPrisma.account.create).not.toHaveBeenCalled();
    });

    it("refuses a second LinkedIn profile for the same account", async () => {
        linkedInAnswers();
        mockPrisma.account.findFirst.mockResolvedValue({ providerAccountId: "other-sub" });

        await expect(connectLinkedInLogin({ code: "c", userId: "user-1" })).rejects.toThrow(/already connected to your account/);
        expect(mockPrisma.account.create).not.toHaveBeenCalled();
    });

    it("does nothing when this profile is already connected to this account", async () => {
        linkedInAnswers();
        mockPrisma.account.findUnique.mockResolvedValue({ userId: "user-1" });
        mockPrisma.account.findFirst.mockResolvedValue({ providerAccountId: "li-sub" });

        await connectLinkedInLogin({ code: "c", userId: "user-1" });
        expect(mockPrisma.account.create).not.toHaveBeenCalled();
    });
});
