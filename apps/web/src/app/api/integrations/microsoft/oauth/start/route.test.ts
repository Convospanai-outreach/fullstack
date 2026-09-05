import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const { mockGetCurrentContext, mockCheckTeamPermission, mockBuildAuthUrl } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockBuildAuthUrl: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { ADMIN: "admin" },
}));
vi.mock("@/modules/email-campaigner/service/microsoftMailboxService", () => ({
    buildMicrosoftMailboxAuthUrl: mockBuildAuthUrl,
}));

function getRequest() {
    return { nextUrl: new URL("http://localhost/api/integrations/microsoft/oauth/start") } as unknown as NextRequest;
}

describe("GET /api/integrations/microsoft/oauth/start", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects an unauthenticated caller without ever building an auth URL", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { GET } = await import("./route");

        const res = await GET(getRequest());

        expect(res.status).toBe(401);
        expect(mockBuildAuthUrl).not.toHaveBeenCalled();
    });

    it("rejects a caller without team admin permission", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(false);
        const { GET } = await import("./route");

        const res = await GET(getRequest());

        expect(res.status).toBe(403);
        expect(mockBuildAuthUrl).not.toHaveBeenCalled();
    });

    it("builds the auth URL scoped to the caller's own session team/user", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockBuildAuthUrl.mockReturnValue("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?state=signed");
        const { GET } = await import("./route");

        const res = await GET(getRequest());

        expect(res.status).toBe(302);
        expect(mockBuildAuthUrl).toHaveBeenCalledWith(
            expect.objectContaining({ teamId: "team-1", userId: "user-1" })
        );
    });
});
