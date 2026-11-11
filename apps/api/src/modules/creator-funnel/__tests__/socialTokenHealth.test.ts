import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    socialAccount: { findMany: vi.fn(), update: vi.fn() },
    teamMember: { findMany: vi.fn() },
}));
const send = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/notifications", () => ({ NotificationDispatcher: { send } }));
vi.mock("@/lib/security/credentialVault", () => ({
    decryptCredential: vi.fn(async (secret: any) => (secret?.cipher === "bad" ? Promise.reject(new Error("bad tag")) : "page-token")),
    encryptCredential: vi.fn(async (value: string) => ({ v: 1, cipher: `enc:${value}`, iv: "i", tag: "t" })),
}));

import { checkSocialTokens } from "../socialTokenHealth";

const now = new Date("2026-09-30T06:00:00Z");
const account = (overrides: any = {}) => ({
    id: "acc-1",
    teamId: "team-a",
    platform: "INSTAGRAM",
    handle: "@mybrand",
    encryptedToken: { v: 1, cipher: "x", iv: "i", tag: "t" },
    expiryWarnedAt: null,
    ...overrides,
});
const debug = (data: any, ok = true) => ({ ok, json: async () => ({ data }) });
const fetchMock = vi.fn();

describe("checkSocialTokens", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["FACEBOOK_APP_ID"] = "app-id";
        process.env["FACEBOOK_APP_SECRET"] = "app-secret";
        vi.stubGlobal("fetch", fetchMock);
        mockDb.socialAccount.findMany.mockResolvedValue([account()]);
        mockDb.teamMember.findMany.mockResolvedValue([{ userId: "admin-1" }]);
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.unstubAllGlobals();
    });

    it("checks only LinkedIn and Instagram Login accounts without the Meta app credentials", async () => {
        delete process.env["FACEBOOK_APP_SECRET"];
        mockDb.socialAccount.findMany.mockResolvedValue([]);
        expect(await checkSocialTokens(now)).toEqual({ checked: 0, needsReconnect: 0, warned: 0 });
        expect(mockDb.socialAccount.findMany.mock.calls[0][0].where.AND[0]).toEqual({
            OR: [{ platform: { in: ["LINKEDIN_MEMBER", "LINKEDIN_ORG"] } }, { platform: "INSTAGRAM", parentExternalId: null }],
        });
    });

    it("still checks and refreshes an Instagram Login account where the Meta app secret isn't set (the worker)", async () => {
        delete process.env["FACEBOOK_APP_ID"];
        delete process.env["FACEBOOK_APP_SECRET"];
        mockDb.socialAccount.findMany.mockResolvedValue([account({ parentExternalId: null, tokenExpiresAt: new Date("2026-10-10T00:00:00Z") })]);
        fetchMock
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user_id: "ig-1" }) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "fresh-token", expires_in: 5183944 }) });

        expect(await checkSocialTokens(now)).toMatchObject({ checked: 1, needsReconnect: 0 });
        expect(fetchMock.mock.calls[0][0]).toContain("graph.instagram.com");
        expect(mockDb.socialAccount.update.mock.calls[0][0].data.encryptedToken).toEqual({ v: 1, cipher: "enc:fresh-token", iv: "i", tag: "t" });
    });

    it("checks connected Meta accounts not checked in the last day, with an app token", async () => {
        fetchMock.mockResolvedValue(debug({ is_valid: true, expires_at: 0, data_access_expires_at: 0 }));

        await checkSocialTokens(now);

        expect(mockDb.socialAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                status: "CONNECTED",
                AND: [
                    { OR: [{ platform: { in: ["FACEBOOK_PAGE", "INSTAGRAM", "LINKEDIN_MEMBER", "LINKEDIN_ORG"] } }, { platform: "INSTAGRAM", parentExternalId: null }] },
                    { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date("2026-09-29T06:00:00Z") } }] },
                ],
            },
        }));
        const url = new URL(fetchMock.mock.calls[0][0]);
        expect(url.pathname).toBe("/v26.0/debug_token");
        expect(url.searchParams.get("input_token")).toBe("page-token");
        expect(url.searchParams.get("access_token")).toBe("app-id|app-secret");
        expect(mockDb.socialAccount.update).toHaveBeenCalledWith({
            where: { id: "acc-1" },
            data: { tokenExpiresAt: null, lastCheckedAt: now, lastError: null },
        });
        expect(send).not.toHaveBeenCalled();
    });

    it("marks an invalid token NEEDS_RECONNECT and tells the team's admins", async () => {
        fetchMock.mockResolvedValue(debug({ is_valid: false, error: { message: "Session has expired" } }));

        expect(await checkSocialTokens(now)).toMatchObject({ checked: 1, needsReconnect: 1 });

        expect(mockDb.socialAccount.update).toHaveBeenCalledWith({
            where: { id: "acc-1" },
            data: { status: "NEEDS_RECONNECT", lastError: "Session has expired", lastCheckedAt: now },
        });
        expect(mockDb.teamMember.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { teamId: "team-a", status: "active", role: { in: ["owner", "admin"] }, userId: { not: null } },
        }));
        expect(send).toHaveBeenCalledWith("admin-1", "SYSTEM", "Reconnect Instagram account @mybrand", expect.stringContaining("reconnect"), { teamId: "team-a" });
    });

    it("treats an unreadable stored token as needing reconnect, without calling Meta", async () => {
        mockDb.socialAccount.findMany.mockResolvedValue([account({ encryptedToken: { v: 1, cipher: "bad", iv: "i", tag: "t" } })]);

        expect((await checkSocialTokens(now)).needsReconnect).toBe(1);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("warns once when the earliest expiry is within a week", async () => {
        const soon = Math.floor(new Date("2026-10-04T00:00:00Z").getTime() / 1000);
        const later = Math.floor(new Date("2026-12-01T00:00:00Z").getTime() / 1000);
        fetchMock.mockResolvedValue(debug({ is_valid: true, expires_at: later, data_access_expires_at: soon }));

        expect((await checkSocialTokens(now)).warned).toBe(1);
        expect(mockDb.socialAccount.update).toHaveBeenCalledWith({
            where: { id: "acc-1" },
            data: { tokenExpiresAt: new Date("2026-10-04T00:00:00Z"), lastCheckedAt: now, lastError: null, expiryWarnedAt: now },
        });
        expect(send).toHaveBeenCalledWith("admin-1", "SYSTEM", "Instagram account @mybrand needs reconnecting soon", expect.any(String), { teamId: "team-a" });

        vi.clearAllMocks();
        mockDb.socialAccount.findMany.mockResolvedValue([account({ expiryWarnedAt: now })]);
        mockDb.teamMember.findMany.mockResolvedValue([{ userId: "admin-1" }]);
        expect((await checkSocialTokens(now)).warned).toBe(0);
        expect(send).not.toHaveBeenCalled();
    });

    it("leaves the status alone when Meta can't be reached", async () => {
        fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: { message: "rate limited" } }) });

        await checkSocialTokens(now);

        expect(mockDb.socialAccount.update).toHaveBeenCalledWith({ where: { id: "acc-1" }, data: { lastCheckedAt: now } });
        expect(send).not.toHaveBeenCalled();
    });
    describe("Instagram Login (no Facebook Page)", () => {
        const igLogin = (overrides: any = {}) => account({ parentExternalId: null, tokenExpiresAt: new Date("2026-12-01T00:00:00Z"), ...overrides });
        const res = (status: number, body: unknown = {}) => ({ ok: status < 400, status, json: async () => body });

        it("checks the token on graph.instagram.com instead of debug_token, and leaves a healthy one alone", async () => {
            mockDb.socialAccount.findMany.mockResolvedValue([igLogin()]);
            fetchMock.mockResolvedValue(res(200, { user_id: "ig-1" }));

            await checkSocialTokens(now);

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0]).toBe("https://graph.instagram.com/v26.0/me?fields=user_id");
            expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer page-token");
            expect(mockDb.socialAccount.update).toHaveBeenCalledWith({
                where: { id: "acc-1" },
                data: { tokenExpiresAt: new Date("2026-12-01T00:00:00Z"), lastCheckedAt: now, lastError: null },
            });
        });

        it("refreshes a token with under 30 days left and stores the new one with its new expiry", async () => {
            mockDb.socialAccount.findMany.mockResolvedValue([igLogin({ tokenExpiresAt: new Date("2026-10-10T00:00:00Z"), expiryWarnedAt: now })]);
            fetchMock
                .mockResolvedValueOnce(res(200, { user_id: "ig-1" }))
                .mockResolvedValueOnce(res(200, { access_token: "fresh-token", token_type: "bearer", expires_in: 5183944 }));

            expect((await checkSocialTokens(now)).warned).toBe(0);

            const refreshUrl = new URL(fetchMock.mock.calls[1][0]);
            expect(refreshUrl.origin + refreshUrl.pathname).toBe("https://graph.instagram.com/refresh_access_token");
            expect(refreshUrl.searchParams.get("grant_type")).toBe("ig_refresh_token");
            expect(refreshUrl.searchParams.get("access_token")).toBe("page-token");
            expect(mockDb.socialAccount.update).toHaveBeenCalledWith({
                where: { id: "acc-1" },
                data: {
                    tokenExpiresAt: new Date(now.getTime() + 5183944 * 1000),
                    lastCheckedAt: now,
                    lastError: null,
                    encryptedToken: { v: 1, cipher: "enc:fresh-token", iv: "i", tag: "t" },
                    expiryWarnedAt: null,
                },
            });
            expect(send).not.toHaveBeenCalled();
        });

        it("keeps a working token when the refresh isn't possible yet, and still warns near expiry", async () => {
            mockDb.socialAccount.findMany.mockResolvedValue([igLogin({ tokenExpiresAt: new Date("2026-10-03T00:00:00Z") })]);
            fetchMock.mockResolvedValueOnce(res(200, { user_id: "ig-1" })).mockResolvedValueOnce(res(400, { error: { message: "token too new" } }));

            expect((await checkSocialTokens(now)).warned).toBe(1);
            expect(mockDb.socialAccount.update.mock.calls[0][0].data).not.toHaveProperty("encryptedToken");
        });

        it("marks a rejected token NEEDS_RECONNECT, but not on a rate limit or an outage", async () => {
            mockDb.socialAccount.findMany.mockResolvedValue([igLogin()]);
            fetchMock.mockResolvedValue(res(400, { error: { code: 190, message: "Error validating access token: Session has expired" } }));
            expect((await checkSocialTokens(now)).needsReconnect).toBe(1);
            expect(mockDb.socialAccount.update).toHaveBeenCalledWith({
                where: { id: "acc-1" },
                data: { status: "NEEDS_RECONNECT", lastError: "Error validating access token: Session has expired", lastCheckedAt: now },
            });

            vi.clearAllMocks();
            mockDb.socialAccount.findMany.mockResolvedValue([igLogin()]);
            fetchMock.mockResolvedValue(res(400, { error: { code: 4, message: "Application request limit reached" } }));
            expect((await checkSocialTokens(now)).needsReconnect).toBe(0);
            expect(mockDb.socialAccount.update).toHaveBeenCalledWith({ where: { id: "acc-1" }, data: { lastCheckedAt: now } });
        });
    });

    describe("LinkedIn", () => {
        const linkedin = (overrides: any = {}) => account({ platform: "LINKEDIN_MEMBER", handle: "Asha Rao", tokenExpiresAt: new Date("2026-11-20T00:00:00Z"), ...overrides });

        it("keeps a working profile token and its saved expiry, using a bearer call and no app secret", async () => {
            delete process.env["FACEBOOK_APP_SECRET"];
            mockDb.socialAccount.findMany.mockResolvedValue([linkedin()]);
            fetchMock.mockResolvedValue({ ok: true, status: 200 });

            await checkSocialTokens(now);

            expect(fetchMock.mock.calls[0][0]).toBe("https://api.linkedin.com/v2/userinfo");
            expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer page-token");
            expect(mockDb.socialAccount.update).toHaveBeenCalledWith({
                where: { id: "acc-1" },
                data: { tokenExpiresAt: new Date("2026-11-20T00:00:00Z"), lastCheckedAt: now, lastError: null },
            });
        });

        it("checks a page token with the page-role finder", async () => {
            mockDb.socialAccount.findMany.mockResolvedValue([linkedin({ platform: "LINKEDIN_ORG" })]);
            fetchMock.mockResolvedValue({ ok: true, status: 200 });
            await checkSocialTokens(now);
            expect(fetchMock.mock.calls[0][0]).toContain("/rest/organizationAcls?q=roleAssignee");
        });

        it("asks for a reconnect once the 60 days are over, without calling LinkedIn", async () => {
            mockDb.socialAccount.findMany.mockResolvedValue([linkedin({ tokenExpiresAt: new Date("2026-09-29T00:00:00Z") })]);
            const result = await checkSocialTokens(now);
            expect(result.needsReconnect).toBe(1);
            expect(fetchMock).not.toHaveBeenCalled();
            expect(mockDb.socialAccount.update.mock.calls[0][0].data.status).toBe("NEEDS_RECONNECT");
        });

        it("asks for a reconnect when LinkedIn rejects the token, and warns a week before expiry", async () => {
            mockDb.socialAccount.findMany.mockResolvedValue([linkedin()]);
            fetchMock.mockResolvedValue({ ok: false, status: 401 });
            expect((await checkSocialTokens(now)).needsReconnect).toBe(1);

            vi.clearAllMocks();
            mockDb.teamMember.findMany.mockResolvedValue([{ userId: "admin-1" }]);
            mockDb.socialAccount.findMany.mockResolvedValue([linkedin({ tokenExpiresAt: new Date("2026-10-03T00:00:00Z") })]);
            fetchMock.mockResolvedValue({ ok: true, status: 200 });
            expect((await checkSocialTokens(now)).warned).toBe(1);
        });

        it("leaves the status alone when LinkedIn can't be reached", async () => {
            mockDb.socialAccount.findMany.mockResolvedValue([linkedin()]);
            fetchMock.mockRejectedValue(new Error("timeout"));
            await checkSocialTokens(now);
            expect(mockDb.socialAccount.update).toHaveBeenCalledWith({ where: { id: "acc-1" }, data: { lastCheckedAt: now } });
        });
    });
});
