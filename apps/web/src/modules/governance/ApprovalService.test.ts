import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        approvalRequest: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        campaign: {
            update: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("./approvalPolicy", async () => {
    const actual = await vi.importActual<typeof import("./approvalPolicy")>("./approvalPolicy");
    return { ...actual, resolveApprovalTier: vi.fn(actual.resolveApprovalTier) };
});

const { mockGetBreakerState } = vi.hoisted(() => ({
    mockGetBreakerState: vi.fn().mockResolvedValue("CLOSED"),
}));

vi.mock("./breakerState", () => ({
    getBreakerState: mockGetBreakerState,
}));

import { ApprovalService } from "./ApprovalService";
import { ApprovalTier, resolveApprovalTier } from "./approvalPolicy";

const mockedResolveApprovalTier = vi.mocked(resolveApprovalTier);

describe("ApprovalService.requestEntityApproval", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetBreakerState.mockResolvedValue("CLOSED");
    });

    it("creates a QUEUED request with a 24h autoDenyAt for a normal action type", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);
        mockPrisma.approvalRequest.create.mockResolvedValue({ id: "req-1" });

        const result = await ApprovalService.requestEntityApproval(
            "lead", "lead-1", "team-1", "manual_followup", {}, "user-1"
        );

        expect(result).toEqual({ id: "req-1", created: true });
        const createArgs = mockPrisma.approvalRequest.create.mock.calls[0][0].data;
        expect(createArgs.tier).toBe(ApprovalTier.QUEUED);
        expect(createArgs.autoDenyAt).toBeInstanceOf(Date);
    });

    it("reuses an existing request for the same entity/action instead of creating a duplicate", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue({ id: "existing-1" });

        const result = await ApprovalService.requestEntityApproval(
            "email", "email-1", "team-1", "email_draft_approval", {}, "user-1"
        );

        expect(result).toEqual({ id: "existing-1", created: false });
        expect(mockPrisma.approvalRequest.create).not.toHaveBeenCalled();
    });

    it("auto-approves immediately when the policy resolves to AUTO", async () => {
        mockedResolveApprovalTier.mockReturnValueOnce(ApprovalTier.AUTO);
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);
        mockPrisma.approvalRequest.create.mockResolvedValue({ id: "req-2" });
        mockPrisma.approvalRequest.findUnique.mockResolvedValue({ id: "req-2", actionType: "SOME_LOW_RISK_ACTION", entityId: "e-1" });
        mockPrisma.approvalRequest.update.mockResolvedValue({ id: "req-2" });

        await ApprovalService.requestEntityApproval(
            "email", "email-1", "team-1", "SOME_LOW_RISK_ACTION", {}, "user-1"
        );

        expect(mockPrisma.approvalRequest.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "req-2" } })
        );
    });

    it("extends the QUEUED timeout to 72h when the team's circuit breaker is OPEN", async () => {
        mockGetBreakerState.mockResolvedValue("OPEN");
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);
        mockPrisma.approvalRequest.create.mockResolvedValue({ id: "req-3" });

        const before = Date.now();
        await ApprovalService.requestEntityApproval(
            "lead", "lead-1", "team-1", "manual_followup", {}, "user-1"
        );

        const createArgs = mockPrisma.approvalRequest.create.mock.calls[0][0].data;
        const hoursOut = (createArgs.autoDenyAt.getTime() - before) / (60 * 60 * 1000);
        expect(hoursOut).toBeGreaterThan(70);
        expect(hoursOut).toBeLessThan(73);
    });
});

describe("ApprovalService.autoDenyExpiredApprovals", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("only rejects PENDING + QUEUED-tier + expired requests", async () => {
        mockPrisma.approvalRequest.findMany.mockResolvedValue([{ id: "req-a" }]);
        mockPrisma.approvalRequest.update.mockResolvedValue({});

        const count = await ApprovalService.autoDenyExpiredApprovals();

        expect(count).toBe(1);
        const whereClause = mockPrisma.approvalRequest.findMany.mock.calls[0][0].where;
        expect(whereClause.tier).toBe(ApprovalTier.QUEUED);
        expect(whereClause.status).toBe("PENDING");
    });
});
