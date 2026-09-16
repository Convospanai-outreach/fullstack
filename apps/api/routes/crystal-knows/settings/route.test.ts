import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContextFromRequest, mockCheckTeamPermission, mockPrisma, mockSetTeamCrystalApiKey, mockClearTeamCrystalApiKey, mockVerifyCrystalApiKey } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockPrisma: {
        team: { findUnique: vi.fn() },
    },
    mockSetTeamCrystalApiKey: vi.fn(),
    mockClearTeamCrystalApiKey: vi.fn(),
    mockVerifyCrystalApiKey: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/modules/crystal-knows/crystalCredentials", () => ({
    setTeamCrystalApiKey: mockSetTeamCrystalApiKey,
    clearTeamCrystalApiKey: mockClearTeamCrystalApiKey,
    verifyCrystalApiKey: mockVerifyCrystalApiKey,
}));

import { GET, POST } from "./route";

function getRequest() {
    return new Request("http://localhost/crystal-knows/settings") as any;
}

function postRequest(body: unknown) {
    return new Request("http://localhost/crystal-knows/settings", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("/crystal-knows/settings - requires ADMIN", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.team.findUnique.mockResolvedValue({ crystalApiKeyEnc: null, crystalApiKeyConfiguredAt: null });
    });

    it("GET rejects a caller below ADMIN role before reading the team's key state", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await GET(getRequest());

        expect(res.status).toBe(403);
        expect(mockPrisma.team.findUnique).not.toHaveBeenCalled();
    });

    it("GET succeeds for an ADMIN caller and never returns the raw key", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({ crystalApiKeyEnc: { v: 1 }, crystalApiKeyConfiguredAt: new Date() });

        const res = await GET(getRequest());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({ hasKey: true, configuredAt: expect.any(String) });
    });

    it("POST rejects a caller below ADMIN role before verifying or storing a key", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await POST(postRequest({ apiKey: "sk-crystal-abc" }));

        expect(res.status).toBe(403);
        expect(mockVerifyCrystalApiKey).not.toHaveBeenCalled();
        expect(mockSetTeamCrystalApiKey).not.toHaveBeenCalled();
    });

    it("POST rejects an unverifiable key with a 422 and does not store it", async () => {
        mockVerifyCrystalApiKey.mockResolvedValue({ ok: false, reason: "Crystal rejected this API key." });

        const res = await POST(postRequest({ apiKey: "sk-bad" }));

        expect(res.status).toBe(422);
        expect(mockSetTeamCrystalApiKey).not.toHaveBeenCalled();
    });

    it("POST verifies then stores a valid key for an ADMIN caller", async () => {
        mockVerifyCrystalApiKey.mockResolvedValue({ ok: true });
        mockSetTeamCrystalApiKey.mockResolvedValue(undefined);

        const res = await POST(postRequest({ apiKey: "sk-crystal-abc" }));

        expect(res.status).toBe(200);
        expect(mockSetTeamCrystalApiKey).toHaveBeenCalledWith("team-1", "sk-crystal-abc");
    });

    it("POST clears the key when hasKey is explicitly false", async () => {
        const res = await POST(postRequest({ hasKey: false }));

        expect(res.status).toBe(200);
        expect(mockClearTeamCrystalApiKey).toHaveBeenCalledWith("team-1");
    });
});
