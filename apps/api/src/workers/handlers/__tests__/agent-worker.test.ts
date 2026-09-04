import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        agent: { update: vi.fn() },
        agentTask: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
        agentLog: { create: vi.fn(), count: vi.fn() },
        campaign: { count: vi.fn() },
        lead: { count: vi.fn() },
        approvalRequest: { count: vi.fn() },
        activity: { create: vi.fn() },
    },
}));

vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { prisma } from "@/lib/db";
import { handleAgentRun } from "../agent-worker";

describe("agent-worker handleAgentRun", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.agent.update as any).mockResolvedValue({});
        (prisma.campaign.count as any).mockResolvedValue(0);
        (prisma.lead.count as any).mockResolvedValue(0);
        (prisma.approvalRequest.count as any).mockResolvedValue(0);
        (prisma.activity.create as any).mockResolvedValue({});
        (prisma.agentLog.create as any).mockResolvedValue({});
        (prisma.agentTask.update as any).mockResolvedValue({});
        (prisma.agentTask.findUnique as any).mockResolvedValue({ context: {}, plan: [] });
    });

    it("throws when agentId is missing", async () => {
        await expect(handleAgentRun({ taskId: "task-1", teamId: "team-a" } as any)).rejects.toThrow(
            "Missing agentId"
        );
    });

    it("refuses to run against a taskId that doesn't belong to the payload's teamId, without mutating it", async () => {
        (prisma.agentTask.findFirst as any).mockResolvedValue(null);

        await expect(
            handleAgentRun({ agentId: "agent-1", taskId: "task-from-team-b", teamId: "team-a" } as any)
        ).rejects.toThrow("AgentTask task-from-team-b does not belong to team team-a");

        expect(prisma.agentTask.findFirst).toHaveBeenCalledWith({
            where: { id: "task-from-team-b", teamId: "team-a" },
            select: { id: true },
        });
        expect(prisma.agentTask.update).not.toHaveBeenCalled();
        expect(prisma.agent.update).not.toHaveBeenCalled();
    });

    it("runs normally when the taskId belongs to the payload's teamId", async () => {
        (prisma.agentTask.findFirst as any).mockResolvedValue({ id: "task-1" });

        const result = await handleAgentRun({
            agentId: "agent-1",
            taskId: "task-1",
            teamId: "team-a",
            role: "Auditor",
            goal: "Check things",
        } as any);

        expect(prisma.agentTask.update).toHaveBeenCalled();
        expect(result).toMatchObject({ success: true });
    });

    it("runs without an ownership check when no teamId is supplied", async () => {
        const result = await handleAgentRun({
            agentId: "agent-1",
            taskId: "task-1",
            role: "Auditor",
            goal: "Check things",
        } as any);

        expect(prisma.agentTask.findFirst).not.toHaveBeenCalled();
        expect(prisma.agentTask.update).toHaveBeenCalled();
        expect(result).toMatchObject({ success: true });
    });
});
