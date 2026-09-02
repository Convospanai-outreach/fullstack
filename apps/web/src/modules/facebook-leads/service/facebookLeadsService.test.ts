import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockEncryptCredential } = vi.hoisted(() => ({
    mockPrisma: {
        facebookLeadSource: { upsert: vi.fn() },
    },
    mockEncryptCredential: vi.fn(async (plaintext: string) => ({ v: 1, cipher: plaintext, iv: "iv", tag: "tag" })),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/security/credentialVault", () => ({ encryptCredential: mockEncryptCredential }));

import { buildFacebookLeadsAuthUrl, connectFacebookPages } from "./facebookLeadsService";

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
});
