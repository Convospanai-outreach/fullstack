import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
    featureFlag: { findUnique: vi.fn() },
    socialAccount: { upsert: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/security/credentialVault", () => ({ encryptCredential: vi.fn(async (plain: string) => ({ sealed: plain })) }));

import { buildLinkedInAuthUrl, connectLinkedIn, linkedInAvailable, parseScopes, verifyLinkedInState } from "./linkedinConnect";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const stateFrom = (url: string) => new URL(url).searchParams.get("state");

describe("linkedinConnect", () => {
    const env = { ...process.env };
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["NEXTAUTH_SECRET"] = "test-secret";
        process.env["LINKEDIN_CLIENT_ID"] = "profile-client";
        process.env["LINKEDIN_CLIENT_SECRET"] = "profile-secret";
        process.env["LINKEDIN_REDIRECT_URI"] = "https://app.test/api/integrations/linkedin/oauth/callback";
        delete process.env["LINKEDIN_PAGES_CLIENT_ID"];
        delete process.env["LINKEDIN_PAGES_CLIENT_SECRET"];
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        mockPrisma.socialAccount.upsert.mockResolvedValue({ id: "acc-1" });
    });

    afterEach(() => {
        process.env = { ...env };
        vi.unstubAllGlobals();
    });

    describe("state", () => {
        it("round-trips a fresh state and asks only for the profile scopes", () => {
            const url = buildLinkedInAuthUrl({ teamId: "team-1", userId: "user-1", kind: "profile" });
            expect(new URL(url).searchParams.get("scope")).toBe("openid profile w_member_social");
            expect(new URL(url).searchParams.get("client_id")).toBe("profile-client");
            expect(verifyLinkedInState(stateFrom(url))).toMatchObject({ teamId: "team-1", userId: "user-1", kind: "profile" });
        });

        it("rejects a tampered, malformed or expired state", () => {
            const state = stateFrom(buildLinkedInAuthUrl({ teamId: "team-1", userId: "user-1", kind: "profile" }))!;
            const [body, sig] = state.split(".");
            const forged = Buffer.from(JSON.stringify({ teamId: "team-2", userId: "user-1", kind: "profile", nonce: "n", ts: Date.now() })).toString("base64url");
            expect(verifyLinkedInState(`${forged}.${sig}`)).toBeNull();
            expect(verifyLinkedInState(body!)).toBeNull();
            expect(verifyLinkedInState(null)).toBeNull();
            expect(verifyLinkedInState(state, Date.now() + 31 * 60 * 1000)).toBeNull();
        });
    });

    it("reads scopes separated by spaces or commas", () => {
        expect(parseScopes("openid profile w_member_social")).toEqual(["openid", "profile", "w_member_social"]);
        expect(parseScopes("openid,profile,w_member_social")).toEqual(["openid", "profile", "w_member_social"]);
        expect(parseScopes(undefined)).toEqual([]);
    });

    describe("availability", () => {
        it("offers pages only with the pages app configured and the platform switch on", async () => {
            expect(await linkedInAvailable("profile")).toBe(true);
            expect(await linkedInAvailable("pages")).toBe(false);

            process.env["LINKEDIN_PAGES_CLIENT_ID"] = "pages-client";
            process.env["LINKEDIN_PAGES_CLIENT_SECRET"] = "pages-secret";
            mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
            expect(await linkedInAvailable("pages")).toBe(false);
            mockPrisma.featureFlag.findUnique.mockResolvedValue({ isEnabled: true });
            expect(await linkedInAvailable("pages")).toBe(true);
        });

        it("offers nothing when the profile app isn't configured, or in production without a redirect URL", async () => {
            delete process.env["LINKEDIN_REDIRECT_URI"];
            (process.env as Record<string, string>)["NODE_ENV"] = "production";
            expect(await linkedInAvailable("profile")).toBe(false);
            process.env["LINKEDIN_REDIRECT_URI"] = "https://app.test/cb";
            delete process.env["LINKEDIN_CLIENT_SECRET"];
            expect(await linkedInAvailable("profile")).toBe(false);
        });
    });

    it("saves the profile as a person URN with its encrypted token, scopes and expiry", async () => {
        fetchMock
            .mockResolvedValueOnce(json({ access_token: "member-token", expires_in: 5184000, scope: "openid,profile,w_member_social" }))
            .mockResolvedValueOnce(json({ sub: "abc123", name: " Asha Rao " }));

        const count = await connectLinkedIn({ code: "code-1", state: { teamId: "team-1", userId: "user-1", kind: "profile", nonce: "n", ts: Date.now() } });

        expect(count).toBe(1);
        const tokenCall = fetchMock.mock.calls[0]!;
        expect(tokenCall[0]).toBe("https://www.linkedin.com/oauth/v2/accessToken");
        expect(String(tokenCall[1].body)).toContain("client_secret=profile-secret");
        expect(fetchMock.mock.calls[1]![1].headers.Authorization).toBe("Bearer member-token");
        const upsert = mockPrisma.socialAccount.upsert.mock.calls[0]![0];
        expect(upsert.where.teamId_platform_externalId).toEqual({ teamId: "team-1", platform: "LINKEDIN_MEMBER", externalId: "urn:li:person:abc123" });
        expect(upsert.create).toMatchObject({ handle: "Asha Rao", encryptedToken: { sealed: "member-token" }, scopes: ["openid", "profile", "w_member_social"], status: "CONNECTED", connectedById: "user-1" });
        expect(upsert.create.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 59 * 24 * 3600 * 1000);
    });

    it("saves each page the member can post to, under the pages app, without linking it to a person", async () => {
        process.env["LINKEDIN_PAGES_CLIENT_ID"] = "pages-client";
        process.env["LINKEDIN_PAGES_CLIENT_SECRET"] = "pages-secret";
        fetchMock
            .mockResolvedValueOnce(json({ access_token: "pages-token", expires_in: 5184000, scope: "w_organization_social rw_organization_admin" }))
            .mockResolvedValueOnce(json({
                elements: [
                    { role: "ADMINISTRATOR", organization: "urn:li:organization:111", state: "APPROVED" },
                    { role: "CONTENT_ADMINISTRATOR", organizationTarget: "urn:li:organization:222", state: "APPROVED" },
                    { role: "ANALYST", organization: "urn:li:organization:333", state: "APPROVED" },
                ],
            }))
            .mockResolvedValueOnce(json({ results: { "111": { localizedName: "Maker Co" } } }));

        const count = await connectLinkedIn({ code: "code-1", state: { teamId: "team-1", userId: "user-1", kind: "pages", nonce: "n", ts: Date.now() } });

        expect(count).toBe(2);
        expect(String(fetchMock.mock.calls[0]![1].body)).toContain("client_secret=pages-secret");
        expect(fetchMock.mock.calls[1]![1].headers["LinkedIn-Version"]).toMatch(/^\d{6}$/);
        expect(fetchMock.mock.calls[2]![0]).toContain("/rest/organizationsLookup?ids=List(111,222)");
        const rows = mockPrisma.socialAccount.upsert.mock.calls.map((c: any[]) => c[0].create);
        expect(rows.map((r: any) => [r.platform, r.externalId, r.handle, r.parentExternalId])).toEqual([
            ["LINKEDIN_ORG", "urn:li:organization:111", "Maker Co", null],
            ["LINKEDIN_ORG", "urn:li:organization:222", null, null],
        ]);
    });

    it("records all requested scopes when the token response doesn't list them", async () => {
        fetchMock.mockResolvedValueOnce(json({ access_token: "member-token", expires_in: 5184000 })).mockResolvedValueOnce(json({ sub: "abc123" }));
        await connectLinkedIn({ code: "code-1", state: { teamId: "team-1", userId: "user-1", kind: "profile", nonce: "n", ts: Date.now() } });
        expect(mockPrisma.socialAccount.upsert.mock.calls[0]![0].create.scopes).toEqual(["openid", "profile", "w_member_social"]);
    });

    it("fails without saving when LinkedIn refuses the code", async () => {
        fetchMock.mockResolvedValueOnce(json({ error: "invalid_request" }, 400));
        await expect(connectLinkedIn({ code: "bad", state: { teamId: "team-1", userId: "user-1", kind: "profile", nonce: "n", ts: Date.now() } })).rejects.toThrow(
            "LinkedIn didn't accept the sign-in"
        );
        expect(mockPrisma.socialAccount.upsert).not.toHaveBeenCalled();
    });
});
