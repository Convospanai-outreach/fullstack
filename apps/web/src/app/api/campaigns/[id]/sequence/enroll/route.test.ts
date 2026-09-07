import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockCheckTeamPermission } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn() },
        campaignSequence: { findFirst: vi.fn(), update: vi.fn() },
        lead: { findMany: vi.fn() },
        sequenceEnrollment: { createMany: vi.fn() },
    },
    mockCheckTeamPermission: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));

import { POST } from "./route";

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("POST /api/campaigns/[id]/sequence/enroll - requires at least MEMBER (OPEN-217)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", teamId: "team-1" });
        mockPrisma.campaignSequence.findFirst.mockResolvedValue({
            id: "seq-1",
            status: "ACTIVE",
            steps: [{ stepOrder: 0, stepType: "email", delayDays: 0, delayHours: 0 }],
        });
        mockPrisma.lead.findMany.mockResolvedValue([{ id: "lead-1" }]);
        mockPrisma.sequenceEnrollment.createMany.mockResolvedValue({ count: 1 });
    });

    it("rejects a caller below MEMBER role before enrolling any lead", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await POST(new Request("http://localhost") as any, paramsFor("campaign-1"));

        expect(res.status).toBe(403);
        expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.sequenceEnrollment.createMany).not.toHaveBeenCalled();
    });

    it("enrolls leads for a MEMBER-or-above caller", async () => {
        const res = await POST(new Request("http://localhost") as any, paramsFor("campaign-1"));

        expect(res.status).toBe(200);
        expect(mockPrisma.sequenceEnrollment.createMany).toHaveBeenCalled();
    });
});
