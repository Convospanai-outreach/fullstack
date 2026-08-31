import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizePermission, mockPrisma, mockApprovalService, mockStartTask, mockRunToCompletion } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizePermission: vi.fn(),
    mockPrisma: {
        approvalRequest: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    mockApprovalService: {
        approve: vi.fn(),
        reject: vi.fn(),
    },
    mockStartTask: vi.fn(),
    mockRunToCompletion: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/permissions")>();
    return { ...actual, authorizePermission: mockAuthorizePermission };
});
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: mockApprovalService }));
vi.mock("@/modules/agent/core/AgentExecutor", () => ({
    AgentExecutor: class {
        startTask = mockStartTask;
        runToCompletion = mockRunToCompletion;
    },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("agent.ts server actions - identity/tenancy cannot be spoofed by the caller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "real-user", teamId: "real-team" });
        mockAuthorizePermission.mockResolvedValue(undefined);
        mockRunToCompletion.mockResolvedValue(undefined);
        mockStartTask.mockResolvedValue("task-1");
    });

    it("startAgentTask uses the session's real teamId, ignoring the caller-supplied one", async () => {
        const { startAgentTask } = await import("./agent");

        await startAgentTask("goal", "attacker-supplied-team");

        expect(mockStartTask).toHaveBeenCalledWith("real-team", "goal");
    });

    it("approveTask rejects a request that doesn't belong to the session's team (cross-tenant IDOR)", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);
        const { approveTask } = await import("./agent");

        await expect(approveTask("req-from-other-team", "attacker-supplied-user")).rejects.toThrow("Request not found");

        expect(mockPrisma.approvalRequest.findFirst).toHaveBeenCalledWith({
            where: { id: "req-from-other-team", teamId: "real-team" },
        });
        expect(mockApprovalService.approve).not.toHaveBeenCalled();
    });

    it("approveTask uses the session's real userId as reviewerId, ignoring the caller-supplied approverId", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue({ id: "req-1", teamId: "real-team" });
        const { approveTask } = await import("./agent");

        await approveTask("req-1", "attacker-supplied-user");

        expect(mockApprovalService.approve).toHaveBeenCalledWith("req-1", "real-user", undefined);
    });

    it("approveTask requires RESOLVE_APPROVALS permission", async () => {
        mockAuthorizePermission.mockRejectedValue(new Error("Insufficient permissions"));
        const { approveTask } = await import("./agent");

        await expect(approveTask("req-1", "any")).rejects.toThrow("Insufficient permissions");
        expect(mockApprovalService.approve).not.toHaveBeenCalled();
    });

    it("rejectTask rejects a request that doesn't belong to the session's team (cross-tenant IDOR)", async () => {
        mockPrisma.approvalRequest.findFirst.mockResolvedValue(null);
        const { rejectTask } = await import("./agent");

        await expect(rejectTask("req-from-other-team", "attacker-supplied-user")).rejects.toThrow("Request not found");
        expect(mockApprovalService.reject).not.toHaveBeenCalled();
    });

    it("getPendingApprovals queries by the session's real teamId, ignoring the caller-supplied one", async () => {
        mockPrisma.approvalRequest.findMany.mockResolvedValue([]);
        const { getPendingApprovals } = await import("./agent");

        await getPendingApprovals("attacker-supplied-team");

        expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ teamId: "real-team" }) })
        );
    });

    it("throws Unauthorized when there is no real session", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { approveTask, rejectTask, startAgentTask, getPendingApprovals } = await import("./agent");

        await expect(startAgentTask("goal", "team")).rejects.toThrow("Unauthorized");
        await expect(approveTask("req-1", "user")).rejects.toThrow("Unauthorized");
        await expect(rejectTask("req-1", "user")).rejects.toThrow("Unauthorized");
        await expect(getPendingApprovals("team")).rejects.toThrow("Unauthorized");
    });
});
