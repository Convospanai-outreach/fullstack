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
        teamMember: {
            findMany: vi.fn(),
        },
        notification: {
            findFirst: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

const { mockSendAlert } = vi.hoisted(() => ({
    mockSendAlert: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/modules/notifications/service/notificationService", () => ({
    notificationService: { sendAlert: mockSendAlert },
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

const { mockEventStoreRecord } = vi.hoisted(() => ({
    mockEventStoreRecord: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/modules/learning/EventStore", () => ({
    EventStore: { record: mockEventStoreRecord },
    SystemEventType: { USER: "USER" },
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

describe("ApprovalService.warnExpiringApprovals", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("queries only PENDING + QUEUED requests inside the warning window and warns each team's owner/admin approvers", async () => {
        mockPrisma.approvalRequest.findMany.mockResolvedValue([
            { teamId: "team-1" },
            { teamId: "team-1" },
        ]);
        mockPrisma.teamMember.findMany.mockResolvedValue([{ userId: "owner-1" }, { userId: "admin-1" }]);
        mockPrisma.notification.findFirst.mockResolvedValue(null);

        const warned = await ApprovalService.warnExpiringApprovals();

        expect(warned).toBe(2);
        const where = mockPrisma.approvalRequest.findMany.mock.calls[0][0].where;
        expect(where.status).toBe("PENDING");
        expect(where.tier).toBe(ApprovalTier.QUEUED);
        expect(where.autoDenyAt.gt).toBeInstanceOf(Date);
        expect(where.autoDenyAt.lte).toBeInstanceOf(Date);
        // Only owner/admin approvers are targeted.
        expect(mockPrisma.teamMember.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teamId: "team-1", status: "active", role: { in: ["owner", "admin"] } } })
        );
        // Digest count is per-team (2 expiring for team-1).
        expect(mockSendAlert).toHaveBeenCalledTimes(2);
        expect(mockSendAlert).toHaveBeenCalledWith(
            "owner-1",
            "warning",
            expect.stringContaining("2 approval requests"),
            expect.objectContaining({ kind: "approval_expiry_warning", teamId: "team-1", count: 2 })
        );
    });

    it("does not re-warn an approver who already got an expiry warning this window (dedup)", async () => {
        mockPrisma.approvalRequest.findMany.mockResolvedValue([{ teamId: "team-1" }]);
        mockPrisma.teamMember.findMany.mockResolvedValue([{ userId: "owner-1" }]);
        mockPrisma.notification.findFirst.mockResolvedValue({ id: "existing-warning" });

        const warned = await ApprovalService.warnExpiringApprovals();

        expect(warned).toBe(0);
        expect(mockSendAlert).not.toHaveBeenCalled();
    });

    it("returns 0 and notifies nobody when nothing is expiring", async () => {
        mockPrisma.approvalRequest.findMany.mockResolvedValue([]);

        const warned = await ApprovalService.warnExpiringApprovals();

        expect(warned).toBe(0);
        expect(mockPrisma.teamMember.findMany).not.toHaveBeenCalled();
        expect(mockSendAlert).not.toHaveBeenCalled();
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

describe("ApprovalService.approve / reject - draft feedback recording", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("records DRAFT_FEEDBACK_RECEIVED on approve when the request carries a draftEmailId", async () => {
        mockPrisma.approvalRequest.findFirst
            .mockResolvedValueOnce({ id: "req-1", teamId: "team-a", actionType: "NETJANA_FOLLOWUP_REVIEW", entityType: "Lead", entityId: "lead-1", payload: { draftEmailId: "email-1" } })
            .mockResolvedValueOnce({ id: "req-1", teamId: "team-a", status: "APPROVED" });
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });

        await ApprovalService.approve("req-1", "user-a", "team-a");

        expect(mockEventStoreRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "DRAFT_FEEDBACK_RECEIVED",
                teamId: "team-a",
                payload: expect.objectContaining({ draftEmailId: "email-1", feedbackType: "APPROVED", entityType: "Lead", entityId: "lead-1" }),
            })
        );
    });

    it("records DRAFT_FEEDBACK_RECEIVED on reject when the request carries a draftEmailId", async () => {
        mockPrisma.approvalRequest.findFirst
            .mockResolvedValueOnce({ id: "req-1", teamId: "team-a", actionType: "NETJANA_FOLLOWUP_REVIEW", entityType: "Lead", entityId: "lead-1", payload: { draftEmailId: "email-1" } })
            .mockResolvedValueOnce({ id: "req-1", teamId: "team-a", status: "REJECTED" });
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });

        await ApprovalService.reject("req-1", "user-a", "team-a", "not relevant");

        expect(mockEventStoreRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "DRAFT_FEEDBACK_RECEIVED",
                payload: expect.objectContaining({ draftEmailId: "email-1", feedbackType: "REJECTED" }),
            })
        );
    });

    it("does not record feedback when the request has no draftEmailId", async () => {
        mockPrisma.approvalRequest.findFirst
            .mockResolvedValueOnce({ id: "req-1", teamId: "team-a", actionType: "CAMPAIGN_START", entityType: "Campaign", entityId: "camp-1", payload: {} })
            .mockResolvedValueOnce({ id: "req-1", teamId: "team-a", status: "APPROVED" });
        mockPrisma.campaign.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });

        await ApprovalService.approve("req-1", "user-a", "team-a");

        expect(mockEventStoreRecord).not.toHaveBeenCalled();
    });
});
