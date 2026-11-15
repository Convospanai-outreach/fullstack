import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockGetCurrentContextFromRequest, mockCheckTeamPermission, mockPrisma, mockSetTeamWaba,
    mockVerifyWabaCredentials, mockVerifyWabaAccount, mockGetConfig, mockExchange, mockSubscribe,
} = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockPrisma: { team: { findFirst: vi.fn() } },
    mockSetTeamWaba: vi.fn(),
    mockVerifyWabaCredentials: vi.fn(),
    mockVerifyWabaAccount: vi.fn(),
    mockGetConfig: vi.fn(),
    mockExchange: vi.fn(),
    mockSubscribe: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/modules/whatsapp/wabaCredentials", () => ({
    setTeamWaba: mockSetTeamWaba,
    verifyWabaCredentials: mockVerifyWabaCredentials,
    verifyWabaAccount: mockVerifyWabaAccount,
}));
vi.mock("@/modules/whatsapp/embeddedSignup", () => ({
    getEmbeddedSignupConfig: mockGetConfig,
    exchangeSignupCode: mockExchange,
    subscribeAppToWaba: mockSubscribe,
}));

import { POST } from "./route";

const BODY = { code: "AQB-signup-code", phoneNumberId: "109876543210987", wabaId: "102290129340398" };

function request(body: unknown) {
    return new Request("http://localhost/whatsapp/embedded-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /whatsapp/embedded-signup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockGetConfig.mockReturnValue({ appId: "app-1", configId: "cfg-1", appSecret: "secret" });
        mockPrisma.team.findFirst.mockResolvedValue(null);
        mockExchange.mockResolvedValue({ ok: true, accessToken: "business-token" });
        mockVerifyWabaCredentials.mockResolvedValue({ ok: true });
        mockVerifyWabaAccount.mockResolvedValue({ ok: true });
        mockSubscribe.mockResolvedValue({ ok: true });
        mockSetTeamWaba.mockResolvedValue(undefined);
    });

    it("rejects an anonymous caller", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });
        expect((await POST(request(BODY))).status).toBe(401);
        expect(mockExchange).not.toHaveBeenCalled();
    });

    it("rejects a caller below ADMIN before touching Meta", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);
        expect((await POST(request(BODY))).status).toBe(403);
        expect(mockExchange).not.toHaveBeenCalled();
        expect(mockSetTeamWaba).not.toHaveBeenCalled();
    });

    it("is unavailable (503) until the Embedded Signup settings exist", async () => {
        mockGetConfig.mockReturnValue(null);
        expect((await POST(request(BODY))).status).toBe(503);
        expect(mockExchange).not.toHaveBeenCalled();
    });

    it("rejects a missing code or non-numeric ids", async () => {
        expect((await POST(request({ ...BODY, code: "" }))).status).toBe(400);
        expect((await POST(request({ ...BODY, phoneNumberId: "abc" }))).status).toBe(400);
        expect((await POST(request({ ...BODY, wabaId: "12" }))).status).toBe(400);
        expect(mockExchange).not.toHaveBeenCalled();
    });

    it("refuses a number that already belongs to another workspace", async () => {
        mockPrisma.team.findFirst.mockResolvedValue({ id: "team-2" });
        expect((await POST(request(BODY))).status).toBe(409);
        expect(mockPrisma.team.findFirst).toHaveBeenCalledWith({
            where: { whatsappPhoneNumberId: BODY.phoneNumberId, NOT: { id: "team-1" } },
            select: { id: true },
        });
        expect(mockExchange).not.toHaveBeenCalled();
        expect(mockSetTeamWaba).not.toHaveBeenCalled();
    });

    it("stores nothing when the code exchange fails", async () => {
        mockExchange.mockResolvedValue({ ok: false, reason: "no" });
        const res = await POST(request(BODY));
        expect(res.status).toBe(422);
        expect(mockSetTeamWaba).not.toHaveBeenCalled();
    });

    it("stores nothing when the token does not verify", async () => {
        mockVerifyWabaCredentials.mockResolvedValue({ ok: false, reason: "bad token" });
        expect((await POST(request(BODY))).status).toBe(422);
        expect(mockSetTeamWaba).not.toHaveBeenCalled();
    });

    it("stores nothing when the account cannot be subscribed to the webhook", async () => {
        mockSubscribe.mockResolvedValue({ ok: false, reason: "no" });
        expect((await POST(request(BODY))).status).toBe(422);
        expect(mockSetTeamWaba).not.toHaveBeenCalled();
    });

    it("verifies, subscribes and stores the team's own token, without returning it", async () => {
        const res = await POST(request(BODY));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(mockExchange).toHaveBeenCalledWith("AQB-signup-code", { appId: "app-1", configId: "cfg-1", appSecret: "secret" });
        expect(mockVerifyWabaCredentials).toHaveBeenCalledWith(BODY.phoneNumberId, "business-token");
        expect(mockVerifyWabaAccount).toHaveBeenCalledWith(BODY.wabaId, "business-token");
        expect(mockSubscribe).toHaveBeenCalledWith(BODY.wabaId, "business-token");
        expect(mockSetTeamWaba).toHaveBeenCalledWith("team-1", BODY.phoneNumberId, "business-token", BODY.wabaId);
        expect(json).toEqual({ hasWaba: true, phoneNumberId: BODY.phoneNumberId, businessAccountId: BODY.wabaId });
        expect(JSON.stringify(json)).not.toContain("business-token");
    });
});
