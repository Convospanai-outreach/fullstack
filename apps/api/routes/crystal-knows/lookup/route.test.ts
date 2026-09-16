import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContextFromRequest, mockCheckTeamPermission, mockFindOrCreateProfile } = vi.hoisted(() => ({
    mockGetCurrentContextFromRequest: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockFindOrCreateProfile: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/modules/crystal-knows/service/crystalService", () => ({
    CrystalService: { findOrCreateProfile: mockFindOrCreateProfile },
}));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/crystal-knows/lookup", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /crystal-knows/lookup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
    });

    it("rejects an unauthenticated caller", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postRequest({ fullName: "Jane Doe" }));

        expect(res.status).toBe(401);
        expect(mockFindOrCreateProfile).not.toHaveBeenCalled();
    });

    it("rejects a caller below MEMBER role (e.g. a VIEWER) before spending a Crystal credit", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await POST(postRequest({ fullName: "Jane Doe" }));

        expect(res.status).toBe(403);
        expect(mockFindOrCreateProfile).not.toHaveBeenCalled();
    });

    it("rejects a body with no identifying field", async () => {
        const res = await POST(postRequest({}));

        expect(res.status).toBe(400);
        expect(mockFindOrCreateProfile).not.toHaveBeenCalled();
    });

    it("returns 422 when the team has no Crystal API key configured", async () => {
        mockFindOrCreateProfile.mockResolvedValue({ state: "not_configured" });

        const res = await POST(postRequest({ fullName: "Jane Doe" }));

        expect(res.status).toBe(422);
    });

    it("returns 502 on an upstream error", async () => {
        mockFindOrCreateProfile.mockResolvedValue({ state: "error", error: "boom" });

        const res = await POST(postRequest({ fullName: "Jane Doe" }));

        expect(res.status).toBe(502);
    });

    it("returns the found profile on success, scoped to the caller's team", async () => {
        mockFindOrCreateProfile.mockResolvedValue({ state: "found", profile: { id: "profile-1" } });

        const res = await POST(postRequest({ fullName: "Jane Doe", email: "jane@acme.com" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({ state: "found", profile: { id: "profile-1" } });
        expect(mockFindOrCreateProfile).toHaveBeenCalledWith(
            "team-1",
            expect.objectContaining({ full_name: "Jane Doe", email: "jane@acme.com" }),
            expect.objectContaining({ recordId: expect.any(String) })
        );
    });

    it("includes jobTitle/companyName in the idempotency key, so a repeated name+different context doesn't reuse a stale job", async () => {
        mockFindOrCreateProfile.mockResolvedValue({ state: "found", profile: { id: "profile-1" } });

        await POST(postRequest({ fullName: "Jane Doe", jobTitle: "VP Sales", companyName: "Acme" }));
        const firstRecordId = mockFindOrCreateProfile.mock.calls[0][2].recordId;

        await POST(postRequest({ fullName: "Jane Doe", jobTitle: "CTO", companyName: "Other Co" }));
        const secondRecordId = mockFindOrCreateProfile.mock.calls[1][2].recordId;

        expect(firstRecordId).not.toBe(secondRecordId);
    });
});
