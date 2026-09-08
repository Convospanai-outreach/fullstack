import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockCheckTeamPermission, mockPrisma, mockSyncLead } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockPrisma: {
        lead: { findFirst: vi.fn() },
    },
    mockSyncLead: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/modules/crm-integration/service/crmService", () => ({
    crmService: { syncLead: mockSyncLead },
}));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/crm/sync", { method: "POST", body: JSON.stringify(body) }) as any;
}

describe("POST /crm/sync - requires ADMIN (OPEN-212)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", teamId: "team-1" });
        mockSyncLead.mockResolvedValue({ success: true });
    });

    it("rejects a caller below ADMIN role (e.g. a VIEWER) before syncing the lead", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await POST(postRequest({ leadId: "lead-1" }));

        expect(res.status).toBe(403);
        expect(mockSyncLead).not.toHaveBeenCalled();
    });

    it("succeeds for an ADMIN caller", async () => {
        const res = await POST(postRequest({ leadId: "lead-1" }));

        expect(res.status).toBe(200);
        expect(mockSyncLead).toHaveBeenCalledWith("lead-1", "team-1");
    });
});
