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

    it("checks only LinkedIn accounts without the Meta app credentials", async () => {
        delete process.env["FACEBOOK_APP_SECRET"];
        mockDb.socialAccount.findMany.mockResolvedValue([]);
        expect(await checkSocialTokens(now)).toEqual({ checked: 0, needsReconnect: 0, warned: 0 });
        expect(mockDb.socialAccount.findMany.mock.calls[0][0].where.platform).toEqual({ in: ["LINKEDIN_MEMBER", "LINKEDIN_ORG"] });
    });

    it("checks connected Meta accounts not checked in the last day, with an app token", async () => {
        fetchMock.mockResolvedValue(debug({ is_valid: true, expires_at: 0, data_access_expires_at: 0 }));

        await checkSocialTokens(now);

        expect(mockDb.socialAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                platform: { in: ["FACEBOOK_PAGE", "INSTAGRAM", "LINKEDIN_MEMBER", "LINKEDIN_ORG"] },
                status: "CONNECTED",
                OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date("2026-09-29T06:00:00Z") } }],
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
