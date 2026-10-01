import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockEncryptCredential } = vi.hoisted(() => ({
    mockPrisma: {
        facebookLeadSource: { upsert: vi.fn() },
        socialAccount: { upsert: vi.fn() },
    },
    mockEncryptCredential: vi.fn(async (plaintext: string) => ({ v: 1, cipher: plaintext, iv: "iv", tag: "tag" })),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/security/credentialVault", () => ({ encryptCredential: mockEncryptCredential }));

import { buildFacebookLeadsAuthUrl, connectFacebookPages, nextPathFromState } from "./facebookLeadsService";

function jsonResponse(body: unknown, ok = true) {
    return { ok, json: async () => body } as Response;
}

describe("facebookLeadsService", () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["FACEBOOK_APP_ID"] = "app-id";
        process.env["FACEBOOK_APP_SECRET"] = "app-secret";
        process.env["FACEBOOK_LEADS_REDIRECT_URI"] = "https://app.example.com/callback";
        process.env["NEXTAUTH_SECRET"] = "a".repeat(32);
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        global.fetch = originalFetch;
    });

    it("builds an auth URL requesting leads_retrieval and signs a verifiable state", () => {
        const url = buildFacebookLeadsAuthUrl({ teamId: "team-1", userId: "user-1" });
        const parsed = new URL(url);
        expect(parsed.searchParams.get("scope")).toContain("leads_retrieval");
        expect(parsed.searchParams.get("client_id")).toBe("app-id");
        expect(parsed.searchParams.get("state")).toBeTruthy();
    });

    it("rejects a tampered state on callback", async () => {
        const url = buildFacebookLeadsAuthUrl({ teamId: "team-1", userId: "user-1" });
        const state = new URL(url).searchParams.get("state")!;
        const tampered = state.slice(0, -1) + (state.endsWith("a") ? "b" : "a");

        await expect(connectFacebookPages({ code: "code", state: tampered })).rejects.toThrow(/Invalid OAuth state/);
    });

    it("exchanges code for a long-lived token and stores one FacebookLeadSource per returned page", async () => {
        const url = buildFacebookLeadsAuthUrl({ teamId: "team-1", userId: "user-1" });
        const state = new URL(url).searchParams.get("state")!;

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: "short-lived" })) // oauth/access_token
            .mockResolvedValueOnce(jsonResponse({ access_token: "long-lived" })) // fb_exchange_token
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: "page-1", name: "My Page", access_token: "page-token" }] })); // me/accounts
        global.fetch = fetchMock as any;
        mockPrisma.facebookLeadSource.upsert.mockResolvedValue({ id: "source-1", pageId: "page-1" });

        const result = await connectFacebookPages({ code: "auth-code", state });

        expect(result.pages).toHaveLength(1);
        expect(mockPrisma.facebookLeadSource.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teamId_pageId: { teamId: "team-1", pageId: "page-1" } },
            })
        );
        expect(mockEncryptCredential).toHaveBeenCalledWith("page-token");
    });

    it("follows /me/accounts pagination instead of only connecting the first page of Pages", async () => {
        const url = buildFacebookLeadsAuthUrl({ teamId: "team-1", userId: "user-1" });
        const state = new URL(url).searchParams.get("state")!;

        const nextAccountsUrl = "https://graph.facebook.com/v21.0/me/accounts?after=cursor123";
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: "short-lived" }))
            .mockResolvedValueOnce(jsonResponse({ access_token: "long-lived" }))
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: "page-1", name: "Page One", access_token: "token-1" }], paging: { next: nextAccountsUrl } }))
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: "page-2", name: "Page Two", access_token: "token-2" }] }));
        global.fetch = fetchMock as any;
        mockPrisma.facebookLeadSource.upsert
            .mockResolvedValueOnce({ id: "source-1", pageId: "page-1" })
            .mockResolvedValueOnce({ id: "source-2", pageId: "page-2" });

        const result = await connectFacebookPages({ code: "auth-code", state });

        expect(fetchMock).toHaveBeenNthCalledWith(4, nextAccountsUrl);
        expect(result.pages).toHaveLength(2);
    });

    it("throws when the account has no manageable Facebook Pages", async () => {
        const url = buildFacebookLeadsAuthUrl({ teamId: "team-1", userId: "user-1" });
        const state = new URL(url).searchParams.get("state")!;

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: "short-lived" }))
            .mockResolvedValueOnce(jsonResponse({ access_token: "long-lived" }))
            .mockResolvedValueOnce(jsonResponse({ data: [] }));
        global.fetch = fetchMock as any;

        await expect(connectFacebookPages({ code: "auth-code", state })).rejects.toThrow(/No Facebook Pages found/);
    });

    describe("social (creator funnel) connect", () => {
        const socialState = () =>
            new URL(buildFacebookLeadsAuthUrl({ teamId: "team-1", userId: "user-1", purpose: "social", nextPath: "/settings/social" })).searchParams.get("state")!;

        it("asks for posting, comment and messaging permissions, not leads_retrieval", () => {
            const scope = new URL(buildFacebookLeadsAuthUrl({ teamId: "team-1", userId: "user-1", purpose: "social" })).searchParams.get("scope")!.split(",");

            expect(scope).toEqual(expect.arrayContaining([
                "pages_manage_posts",
                "pages_messaging",
                "pages_manage_metadata",
                "instagram_basic",
                "instagram_content_publish",
                "instagram_manage_comments",
                "instagram_manage_messages",
            ]));
            expect(scope).not.toContain("leads_retrieval");
        });

        it("stores the Page and its linked Instagram account as SocialAccounts, not FacebookLeadSources", async () => {
            const fetchMock = vi.fn()
                .mockResolvedValueOnce(jsonResponse({ access_token: "short-lived" }))
                .mockResolvedValueOnce(jsonResponse({ access_token: "long-lived", expires_in: 5_184_000 }))
                .mockResolvedValueOnce(jsonResponse({ data: [{ id: "page-1", name: "My Page", access_token: "page-token" }] }))
                .mockResolvedValueOnce(jsonResponse({ data: [{ permission: "pages_manage_posts", status: "granted" }, { permission: "instagram_manage_messages", status: "declined" }] }))
                .mockResolvedValueOnce(jsonResponse({ instagram_business_account: { id: "ig-1", username: "mybrand" }, id: "page-1" }));
            global.fetch = fetchMock as any;
            mockPrisma.socialAccount.upsert.mockImplementation(async (args: any) => ({ id: "x", platform: args.create.platform, handle: args.create.handle }));

            const result = await connectFacebookPages({ code: "auth-code", state: socialState() });

            expect(mockPrisma.facebookLeadSource.upsert).not.toHaveBeenCalled();
            expect(result).toMatchObject({ purpose: "social", nextPath: "/settings/social" });
            expect(result.pages).toHaveLength(2);
            expect(fetchMock.mock.calls[4][0]).toContain("/v26.0/page-1?");

            const [page, ig] = mockPrisma.socialAccount.upsert.mock.calls.map((call: any[]) => call[0]);
            expect(page.where).toEqual({ teamId_platform_externalId: { teamId: "team-1", platform: "FACEBOOK_PAGE", externalId: "page-1" } });
            expect(page.create).toMatchObject({ handle: "My Page", scopes: ["pages_manage_posts"], status: "CONNECTED", connectedById: "user-1" });
            expect(page.create.encryptedToken).toEqual({ v: 1, cipher: "page-token", iv: "iv", tag: "tag" });
            expect(page.create.tokenExpiresAt).toBeNull();
            expect(ig.where.teamId_platform_externalId).toEqual({ teamId: "team-1", platform: "INSTAGRAM", externalId: "ig-1" });
            expect(ig.create).toMatchObject({ handle: "@mybrand", parentExternalId: "page-1" });
            // Instagram publishing needs the User token (about 60 days), not the Page token.
            expect(ig.create.encryptedToken).toEqual({ v: 1, cipher: "long-lived", iv: "iv", tag: "tag" });
            expect(ig.create.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 24 * 60 * 60 * 1000);
            expect(page.select).toEqual({ id: true, platform: true, handle: true });
        });

        it("connects a Page without an Instagram account on its own", async () => {
            global.fetch = vi.fn()
                .mockResolvedValueOnce(jsonResponse({ access_token: "short-lived" }))
                .mockResolvedValueOnce(jsonResponse({ access_token: "long-lived" }))
                .mockResolvedValueOnce(jsonResponse({ data: [{ id: "page-1", name: "My Page", access_token: "page-token" }] }))
                .mockResolvedValueOnce(jsonResponse({ data: [] }))
                .mockResolvedValueOnce(jsonResponse({ id: "page-1" })) as any;
            mockPrisma.socialAccount.upsert.mockResolvedValue({ id: "x", platform: "FACEBOOK_PAGE", handle: "My Page" });

            const result = await connectFacebookPages({ code: "auth-code", state: socialState() });

            expect(result.pages).toHaveLength(1);
        });

        it("reads nextPath only from a verified state", () => {
            const state = socialState();
            expect(nextPathFromState(state)).toBe("/settings/social");
            expect(nextPathFromState(state.slice(0, -1) + (state.endsWith("a") ? "b" : "a"))).toBeNull();
            expect(nextPathFromState(null)).toBeNull();
        });
    });
});
