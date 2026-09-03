import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        approvalRequest: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        campaign: {
            update: vi.fn(),
            updateMany: vi.fn(),
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

vi.mock("@/modules/overseer/breakerService", () => ({
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
            "Campaign", "camp-1", "team-1", "CAMPAIGN_START", {}, "user-1"
        );

        expect(result).toEqual({ id: "req-1", created: true });
        const createArgs = mockPrisma.approvalRequest.create.mock.calls[0][0].data;
        expect(createArgs.tier).toBe(ApprovalTier.QUEUED);
        expect(createArgs.autoDenyAt).toBeInstanceOf(Date);
        expect(mockPrisma.approvalRequest.update).not.toHaveBeenCalled();
    });

    it("auto-approves immediately when the policy resolves to AUTO", async () => {
        mockedResolveApprovalTier.mockReturnValueOnce(ApprovalTier.AUTO);
        mockPrisma.approvalRequest.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "req-2", teamId: "team-1", actionType: "SOME_LOW_RISK_ACTION", entityId: "camp-1" });
        mockPrisma.approvalRequest.create.mockResolvedValue({ id: "req-2" });
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });

        await ApprovalService.requestEntityApproval(
            "Campaign", "camp-1", "team-1", "SOME_LOW_RISK_ACTION", {}, "user-1"
        );

        const createArgs = mockPrisma.approvalRequest.create.mock.calls[0][0].data;
        expect(createArgs.tier).toBe(ApprovalTier.AUTO);
        expect(createArgs.autoDenyAt).toBeNull();
        expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "req-2", teamId: "team-1" } })
        );
    });

    it("does not auto-approve when forceHardBlock escalates the tier", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);
        mockPrisma.approvalRequest.create.mockResolvedValue({ id: "req-3" });

        await ApprovalService.requestEntityApproval(
            "Campaign", "camp-1", "team-1", "CAMPAIGN_START", {}, "user-1", { forceHardBlock: true }
        );

        const createArgs = mockPrisma.approvalRequest.create.mock.calls[0][0].data;
        expect(createArgs.tier).toBe(ApprovalTier.HARD_BLOCK);
        expect(createArgs.autoDenyAt).toBeNull();
        expect(mockPrisma.approvalRequest.update).not.toHaveBeenCalled();
    });

    it("extends the QUEUED timeout to 72h when the team's circuit breaker is OPEN", async () => {
        mockGetBreakerState.mockResolvedValue("OPEN");
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);
        mockPrisma.approvalRequest.create.mockResolvedValue({ id: "req-4" });

        const before = Date.now();
        await ApprovalService.requestEntityApproval(
            "Campaign", "camp-1", "team-1", "CAMPAIGN_START", {}, "user-1"
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

    it("only queries PENDING + QUEUED-tier + expired requests, and rejects each one found", async () => {
        mockPrisma.approvalRequest.findMany.mockResolvedValue([
            { id: "req-a", teamId: "team-1" },
            { id: "req-b", teamId: "team-2" },
        ]);
        mockPrisma.approvalRequest.findFirst.mockResolvedValue({ id: "req-a", teamId: "team-1" });
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });

        const count = await ApprovalService.autoDenyExpiredApprovals();

        expect(count).toBe(2);
        const whereClause = mockPrisma.approvalRequest.findMany.mock.calls[0][0].where;
        expect(whereClause.tier).toBe(ApprovalTier.QUEUED);
        expect(whereClause.status).toBe("PENDING");
        expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledTimes(2);
        expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "req-a", teamId: "team-1" } })
        );
    });

    it("returns 0 and updates nothing when no requests are expired", async () => {
        mockPrisma.approvalRequest.findMany.mockResolvedValue([]);

        const count = await ApprovalService.autoDenyExpiredApprovals();

        expect(count).toBe(0);
        expect(mockPrisma.approvalRequest.update).not.toHaveBeenCalled();
    });
});

describe("ApprovalService.approve / reject - cross-tenant scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("refuses to approve a request that doesn't belong to the given team (cross-tenant IDOR)", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);

        await expect(ApprovalService.approve("req-1", "user-a", "team-a")).rejects.toThrow("Request not found");

        expect(mockPrisma.approvalRequest.findFirst).toHaveBeenCalledWith({ where: { id: "req-1", teamId: "team-a" } });
        expect(mockPrisma.approvalRequest.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.campaign.updateMany).not.toHaveBeenCalled();
    });

    it("refuses to reject a request that doesn't belong to the given team (cross-tenant IDOR)", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);

        await expect(ApprovalService.reject("req-1", "user-a", "team-a")).rejects.toThrow("Request not found");

        expect(mockPrisma.approvalRequest.findFirst).toHaveBeenCalledWith({ where: { id: "req-1", teamId: "team-a" } });
        expect(mockPrisma.approvalRequest.updateMany).not.toHaveBeenCalled();
    });

    it("scopes the approve mutation (and its CAMPAIGN_START side-effect) by teamId, not just the pre-check", async () => {
        mockPrisma.approvalRequest.findFirst
            .mockResolvedValueOnce({ id: "req-1", teamId: "team-a", actionType: "CAMPAIGN_START", entityId: "camp-1" })
            .mockResolvedValueOnce({ id: "req-1", teamId: "team-a", status: "APPROVED" });
        mockPrisma.campaign.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });

        await ApprovalService.approve("req-1", "user-a", "team-a");

        expect(mockPrisma.campaign.updateMany).toHaveBeenCalledWith({
            where: { id: "camp-1", teamId: "team-a" },
            data: { status: "active" },
        });
        expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith({
            where: { id: "req-1", teamId: "team-a" },
            data: expect.objectContaining({ status: "APPROVED" }),
        });
    });

    it("scopes the reject mutation by teamId, not just the pre-check", async () => {
        mockPrisma.approvalRequest.findFirst
            .mockResolvedValueOnce({ id: "req-1", teamId: "team-a", actionType: "SOMETHING" })
            .mockResolvedValueOnce({ id: "req-1", teamId: "team-a", status: "REJECTED" });
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });

        await ApprovalService.reject("req-1", "user-a", "team-a", "not now");

        expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith({
            where: { id: "req-1", teamId: "team-a" },
            data: expect.objectContaining({ status: "REJECTED", reviewNote: "not now" }),
        });
    });
});
