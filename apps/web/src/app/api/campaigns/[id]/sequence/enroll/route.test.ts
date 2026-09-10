import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockCheckTeamPermission } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn() },
        campaignSequence: { findFirst: vi.fn(), update: vi.fn() },
        lead: { findMany: vi.fn() },
        sequenceEnrollment: { createMany: vi.fn() },
        connectedMailbox: { findMany: vi.fn() },
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
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([]);
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

    it("leaves mailboxId unset when the sequence has no configured senders", async () => {
        await POST(new Request("http://localhost") as any, paramsFor("campaign-1"));

        expect(mockPrisma.connectedMailbox.findMany).not.toHaveBeenCalled();
        const data = mockPrisma.sequenceEnrollment.createMany.mock.calls[0]![0].data;
        expect(data[0]).not.toHaveProperty("mailboxId");
    });

    it("distributes enrollments round-robin across the sequence's configured, still-connected senders (e.g. a selected Resend mailbox)", async () => {
        mockPrisma.campaignSequence.findFirst.mockResolvedValue({
            id: "seq-1",
            status: "ACTIVE",
            senderMailboxIds: ["resend-mailbox-1", "gmail-mailbox-1", "disconnected-mailbox-1"],
            steps: [{ stepOrder: 0, stepType: "email", delayDays: 0, delayHours: 0 }],
        });
        mockPrisma.lead.findMany.mockResolvedValue([{ id: "lead-1" }, { id: "lead-2" }, { id: "lead-3" }]);
        // disconnected-mailbox-1 is deliberately omitted, simulating a sender that was
        // disconnected after being selected in the builder - it must not be assigned.
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([
            { id: "resend-mailbox-1" },
            { id: "gmail-mailbox-1" },
        ]);

        await POST(new Request("http://localhost") as any, paramsFor("campaign-1"));

        expect(mockPrisma.connectedMailbox.findMany).toHaveBeenCalledWith({
            where: { id: { in: ["resend-mailbox-1", "gmail-mailbox-1", "disconnected-mailbox-1"] }, teamId: "team-1", status: "CONNECTED" },
            select: { id: true },
        });
        const data = mockPrisma.sequenceEnrollment.createMany.mock.calls[0]![0].data;
        expect(data.map((d: any) => d.mailboxId)).toEqual(["resend-mailbox-1", "gmail-mailbox-1", "resend-mailbox-1"]);
    });
});
