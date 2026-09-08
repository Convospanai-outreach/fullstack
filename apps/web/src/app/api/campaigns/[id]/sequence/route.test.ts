import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockCheckTeamPermission, mockIsEnabled } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn() },
        campaignSequence: { findFirst: vi.fn() },
        connectedMailbox: { count: vi.fn() },
        sequenceStep: { findMany: vi.fn() },
        $transaction: vi.fn(),
    },
    mockCheckTeamPermission: vi.fn(),
    mockIsEnabled: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/lib/flags/service", () => ({
    FeatureFlagService: { isEnabled: mockIsEnabled },
}));

import { PUT } from "./route";

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

function putRequest(body: unknown) {
    return new Request("http://localhost/api/campaigns/campaign-1/sequence", {
        method: "PUT",
        body: JSON.stringify(body),
    }) as any;
}

describe("PUT /api/campaigns/[id]/sequence - requires at least MEMBER (OPEN-217)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1", teamId: "team-1", name: "Campaign" });
        mockIsEnabled.mockResolvedValue(true);
        mockPrisma.$transaction.mockImplementation(async (fn: any) =>
            fn({
                campaignSequence: {
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn().mockResolvedValue({ id: "seq-1" }),
                    update: vi.fn(),
                },
                sequenceStep: {
                    findMany: vi.fn().mockResolvedValue([]),
                    deleteMany: vi.fn(),
                    update: vi.fn(),
                    create: vi.fn(),
                },
            })
        );
        mockPrisma.sequenceStep.findMany.mockResolvedValue([]);
    });

    it("rejects a caller below MEMBER role before touching the sequence", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await PUT(putRequest({ steps: [], senderMailboxIds: [], timezone: "UTC" }), paramsFor("campaign-1"));

        expect(res.status).toBe(403);
        expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("saves the sequence for a MEMBER-or-above caller", async () => {
        const res = await PUT(putRequest({ steps: [], senderMailboxIds: [], timezone: "UTC" }), paramsFor("campaign-1"));

        expect(res.status).toBe(200);
        expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
});
