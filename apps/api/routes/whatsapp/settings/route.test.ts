import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContextFromRequest, mockCheckTeamPermission, mockPrisma, mockSetTeamWaba, mockClearTeamWaba, mockVerifyWabaCredentials } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockPrisma: {
        team: { findUnique: vi.fn() },
    },
    mockSetTeamWaba: vi.fn(),
    mockClearTeamWaba: vi.fn(),
    mockVerifyWabaCredentials: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/modules/whatsapp/wabaCredentials", () => ({
    setTeamWaba: mockSetTeamWaba,
    clearTeamWaba: mockClearTeamWaba,
    verifyWabaCredentials: mockVerifyWabaCredentials,
}));

import { GET, POST } from "./route";

function getRequest() {
    return new Request("http://localhost/whatsapp/settings") as any;
}

function postRequest(body: unknown) {
    return new Request("http://localhost/whatsapp/settings", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("/whatsapp/settings - requires ADMIN (OPEN-210)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.team.findUnique.mockResolvedValue({ whatsappPhoneNumberId: null, whatsappWabaConfiguredAt: null });
    });

    it("GET rejects a caller below ADMIN role (e.g. a VIEWER) before reading the team's WABA config", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await GET(getRequest());

        expect(res.status).toBe(403);
        expect(mockPrisma.team.findUnique).not.toHaveBeenCalled();
    });

    it("GET succeeds for an ADMIN caller", async () => {
        const res = await GET(getRequest());

        expect(res.status).toBe(200);
        expect(mockPrisma.team.findUnique).toHaveBeenCalled();
    });

    it("POST rejects a caller below ADMIN role before setting or clearing WABA credentials", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await POST(postRequest({ phoneNumberId: "123", accessToken: "secret" }));

        expect(res.status).toBe(403);
        expect(mockVerifyWabaCredentials).not.toHaveBeenCalled();
        expect(mockSetTeamWaba).not.toHaveBeenCalled();
        expect(mockClearTeamWaba).not.toHaveBeenCalled();
    });

    it("POST succeeds for an ADMIN caller", async () => {
        mockVerifyWabaCredentials.mockResolvedValue({ ok: true });
        mockSetTeamWaba.mockResolvedValue(undefined);

        const res = await POST(postRequest({ phoneNumberId: "123", accessToken: "secret" }));

        expect(res.status).toBe(200);
        expect(mockSetTeamWaba).toHaveBeenCalledWith("team-1", "123", "secret");
    });
});
