import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        approvalRequest: { findMany: vi.fn() },
        email: { findMany: vi.fn() },
        lead: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: { requestEntityApproval: vi.fn() } }));

import { GET } from "./route";

describe("GET /api/approvals - needs attention", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-1" });
        mockPrisma.email.findMany.mockResolvedValue([]);
    });

    it("lists recent NEEDS_ATTENTION messages for the team with the lead's name", async () => {
        const created = new Date();
        mockPrisma.approvalRequest.findMany
            .mockResolvedValueOnce([]) // existing approvals (backfill check)
            .mockResolvedValueOnce([]) // pending
            .mockResolvedValueOnce([
                { id: "a1", entityId: "lead-1:EMAIL", reason: "Could not write", reviewNote: null, createdAt: created, payload: { channel: "EMAIL", jobType: "email_sending", jobPayload: { leadId: "lead-1" } } },
                { id: "a2", entityId: "lead-9:CONNECT", reason: "x", reviewNote: "Approval expired", createdAt: created, payload: { channel: "CONNECT", body: "sent text" } },
            ]);
        mockPrisma.lead.findMany.mockResolvedValue([{ id: "lead-1", fullName: "Ada", email: "ada@x.com" }]);

        const res = await GET();
        const body = await res.json();

        const attentionQuery = mockPrisma.approvalRequest.findMany.mock.calls[2][0];
        expect(attentionQuery.where).toEqual(
            expect.objectContaining({ teamId: "team-1", actionType: "MESSAGE_SEND", status: "NEEDS_ATTENTION" }),
        );
        expect(mockPrisma.lead.findMany.mock.calls[0][0].where).toEqual(
            expect.objectContaining({ teamId: "team-1", id: { in: ["lead-1", "lead-9"] } }),
        );
        expect(body.needsAttention).toEqual([
            expect.objectContaining({ id: "a1", channel: "EMAIL", leadName: "Ada", reason: "Could not write", canRetry: true }),
            expect.objectContaining({ id: "a2", channel: "CONNECT", leadName: null, reason: "Approval expired", canRetry: false }),
        ]);
    });

    it("skips the lead lookup when nothing needs attention", async () => {
        mockPrisma.approvalRequest.findMany.mockResolvedValue([]);

        const body = await (await GET()).json();

        expect(body.needsAttention).toEqual([]);
        expect(mockPrisma.lead.findMany).not.toHaveBeenCalled();
    });
});
