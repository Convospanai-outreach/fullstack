import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockEncryptCredential } = vi.hoisted(() => ({
    mockPrisma: { socialAccount: { upsert: vi.fn(), update: vi.fn() } },
    mockEncryptCredential: vi.fn(async (plaintext: string) => ({ v: 1, cipher: plaintext, iv: "iv", tag: "tag" })),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/security/credentialVault", () => ({ encryptCredential: mockEncryptCredential }));

import { buildInstagramLoginAuthUrl, connectInstagramLogin, INSTAGRAM_LOGIN_SCOPES } from "./instagramLoginService";
import { buildFacebookLeadsAuthUrl, connectFacebookPages } from "@/modules/facebook-leads/service/facebookLeadsService";

const json = (body: unknown, ok = true, status = ok ? 200 : 400) => ({ ok, status, json: async () => body }) as Response;
const stateOf = (url: string) => new URL(url).searchParams.get("state")!;

describe("instagramLoginService", () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["INSTAGRAM_APP_ID"] = "ig-app-id";
        process.env["INSTAGRAM_APP_SECRET"] = "ig-app-secret";
        process.env["INSTAGRAM_LOGIN_REDIRECT_URI"] = "https://app.example.com/api/integrations/instagram/oauth/callback";
        process.env["FACEBOOK_APP_ID"] = "fb-app-id";
        process.env["FACEBOOK_APP_SECRET"] = "fb-app-secret";
        process.env["FACEBOOK_LEADS_REDIRECT_URI"] = "https://app.example.com/callback";
        process.env["NEXTAUTH_SECRET"] = "a".repeat(32);
        global.fetch = fetchMock as any;
        mockPrisma.socialAccount.upsert.mockResolvedValue({ id: "acc-1", platform: "INSTAGRAM", handle: "@mybrand" });
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        global.fetch = originalFetch;
    });

    describe("buildInstagramLoginAuthUrl", () => {
        it("sends the person to Instagram with the Instagram app id, comment and message permissions, and no publishing", () => {
            const url = new URL(buildInstagramLoginAuthUrl({ teamId: "team-1", userId: "user-1", nextPath: "/settings/social" }));
            expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
            expect(url.searchParams.get("client_id")).toBe("ig-app-id");
            expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/integrations/instagram/oauth/callback");
            expect(url.searchParams.get("response_type")).toBe("code");
            expect(url.searchParams.get("scope")!.split(",")).toEqual(INSTAGRAM_LOGIN_SCOPES);
            expect(url.searchParams.get("scope")).not.toContain("content_publish");
            expect(url.searchParams.get("state")).toBeTruthy();
        });

        it("refuses to build a URL without the Instagram credentials, and never falls back to the Facebook ones", () => {
            delete process.env["INSTAGRAM_APP_ID"];
            expect(() => buildInstagramLoginAuthUrl({ teamId: "t", userId: "u" })).toThrow(/INSTAGRAM_APP_ID/);
        });
    });

    describe("connectInstagramLogin", () => {
        const start = () => stateOf(buildInstagramLoginAuthUrl({ teamId: "team-1", userId: "user-1", nextPath: "/settings/social" }));
        const happyPath = (shortBody: unknown = { data: [{ access_token: "short", user_id: "app-scoped-1", permissions: "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages" }] }) => {
            fetchMock
                .mockResolvedValueOnce(json(shortBody))
                .mockResolvedValueOnce(json({ access_token: "long-lived", token_type: "bearer", expires_in: 5183944 }))
                .mockResolvedValueOnce(json({ user_id: "17841400000000", username: "mybrand" }))
                .mockResolvedValueOnce(json({ success: true }));
        };

        it("swaps the code for a 60-day token, stores the account by its professional id with no parent Page, and turns on webhooks", async () => {
            happyPath();
            const result = await connectInstagramLogin({ code: "the-code#_", state: start() });

            const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
            expect(tokenUrl).toBe("https://api.instagram.com/oauth/access_token");
            const form = new URLSearchParams(String(tokenInit.body));
            expect(Object.fromEntries(form)).toEqual({
                client_id: "ig-app-id",
                client_secret: "ig-app-secret",
                grant_type: "authorization_code",
                redirect_uri: "https://app.example.com/api/integrations/instagram/oauth/callback",
                code: "the-code", // the trailing "#_" is dropped
            });

            const longUrl = new URL(fetchMock.mock.calls[1][0]);
            expect(longUrl.origin + longUrl.pathname).toBe("https://graph.instagram.com/access_token");
            expect(longUrl.searchParams.get("grant_type")).toBe("ig_exchange_token");
            expect(longUrl.searchParams.get("access_token")).toBe("short");
            expect(longUrl.searchParams.get("client_secret")).toBe("ig-app-secret");

            expect(fetchMock.mock.calls[2][0]).toBe("https://graph.instagram.com/v26.0/me?fields=user_id%2Cusername");
            expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer long-lived");

            // The professional account id from /me (what webhooks send), not the id in the token response.
            const upsert = mockPrisma.socialAccount.upsert.mock.calls[0][0];
            expect(upsert.where).toEqual({ teamId_platform_externalId: { teamId: "team-1", platform: "INSTAGRAM", externalId: "17841400000000" } });
            expect(upsert.create).toMatchObject({
                teamId: "team-1",
                platform: "INSTAGRAM",
                externalId: "17841400000000",
                handle: "@mybrand",
                parentExternalId: null,
                status: "CONNECTED",
                connectedById: "user-1",
                scopes: ["instagram_business_basic", "instagram_business_manage_comments", "instagram_business_manage_messages"],
                encryptedToken: { v: 1, cipher: "long-lived", iv: "iv", tag: "tag" },
            });
            expect(upsert.update.parentExternalId).toBeNull(); // reconnecting a Page-linked row detaches it
            expect(upsert.update.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 24 * 3600 * 1000);

            const [subscribeUrl, subscribeInit] = fetchMock.mock.calls[3];
            expect(subscribeUrl).toBe("https://graph.instagram.com/v26.0/17841400000000/subscribed_apps");
            expect(subscribeInit.headers.Authorization).toBe("Bearer long-lived");
            expect(new URLSearchParams(String(subscribeInit.body)).get("subscribed_fields")).toBe("comments,messages");
            expect(mockPrisma.socialAccount.update).not.toHaveBeenCalled();
            expect(result).toMatchObject({ nextPath: "/settings/social", purpose: "social", pages: [{ id: "acc-1" }] });
        });

        it("accepts a flat token response and only subscribes to the fields it was allowed", async () => {
            happyPath({ access_token: "short", user_id: "x", permissions: ["instagram_business_basic", "instagram_business_manage_comments"] });
            await connectInstagramLogin({ code: "c", state: start() });
            expect(new URLSearchParams(String(fetchMock.mock.calls[3][1].body)).get("subscribed_fields")).toBe("comments");
        });

        it("keeps the account but shows the problem when webhooks couldn't be turned on", async () => {
            fetchMock
                .mockResolvedValueOnce(json({ data: [{ access_token: "short", user_id: "x", permissions: "instagram_business_basic,instagram_business_manage_messages" }] }))
                .mockResolvedValueOnce(json({ access_token: "long", expires_in: 5000000 }))
                .mockResolvedValueOnce(json({ user_id: "ig-9", username: "mybrand" }))
                .mockResolvedValueOnce(json({ error: { message: "(#200) Subscription requires the webhooks setup" } }, false));

            await connectInstagramLogin({ code: "c", state: start() });

            expect(mockPrisma.socialAccount.update).toHaveBeenCalledWith({
                where: { id: "acc-1" },
                data: { lastError: "Comments and messages from this account won't reach CMf: (#200) Subscription requires the webhooks setup" },
            });
        });

        it("fails with Instagram's message when the code is rejected, and stores nothing", async () => {
            fetchMock.mockResolvedValueOnce(json({ error_type: "OAuthException", code: 400, error_message: "Matching code was not found or was already used" }, false));
            await expect(connectInstagramLogin({ code: "used", state: start() })).rejects.toThrow("Matching code was not found or was already used");
            expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
        });

        it("fails when the basic permission wasn't granted", async () => {
            happyPath({ data: [{ access_token: "short", user_id: "x", permissions: "instagram_business_manage_messages" }] });
            await expect(connectInstagramLogin({ code: "c", state: start() })).rejects.toThrow(/allow the permissions/);
            expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
        });

        it("rejects a tampered, expired or Facebook-purpose state before calling Instagram", async () => {
            const state = start();
            const tampered = state.slice(0, -1) + (state.endsWith("a") ? "b" : "a");
            await expect(connectInstagramLogin({ code: "c", state: tampered })).rejects.toThrow(/signature/i);

            const facebookState = stateOf(buildFacebookLeadsAuthUrl({ teamId: "team-1", userId: "user-1", purpose: "social" }));
            await expect(connectInstagramLogin({ code: "c", state: facebookState })).rejects.toThrow("Invalid OAuth state.");

            vi.useFakeTimers();
            try {
                vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
                const old = start();
                vi.setSystemTime(new Date("2030-01-01T00:16:00Z"));
                await expect(connectInstagramLogin({ code: "c", state: old })).rejects.toThrow(/too long/);
            } finally {
                vi.useRealTimers();
            }
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("can't be completed through the Facebook callback", async () => {
            await expect(connectFacebookPages({ code: "c", state: start() })).rejects.toThrow("Invalid OAuth state.");
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });
});
