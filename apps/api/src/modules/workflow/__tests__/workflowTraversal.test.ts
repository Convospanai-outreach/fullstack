import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { WorkflowService } from "@/lib/workflowService";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

vi.mock("@/lib/db", () => ({
    prisma: {
        workflow: {
            findUnique: vi.fn(),
        },
        workflowRun: {
            findUnique: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        },
        lead: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
        },
    },
}));

vi.mock("@/lib/queue", () => ({
    JobQueue: {
        enqueue: vi.fn(),
    },
}));

describe("WorkflowService DAG Traversal & Tenant Isolation (SEC-05)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should process an AI node and move to the next step", async () => {
        const mockRun = {
            id: "run-1",
            status: "RUNNING",
            context: {},
            workflow: {
                teamId: "team-1",
                nodes: [
                    { id: "node-1", type: "ai", data: { label: "Draft" } },
                    { id: "node-2", type: "action", data: { actionType: "EMAIL" } },
                ],
                edges: [
                    { source: "node-1", target: "node-2" },
                ],
            },
        };

        (prisma.workflowRun.findUnique as Mock).mockResolvedValue(mockRun);

        await WorkflowService.processNode("run-1", "node-1");

        // Verify next node was enqueued
        expect(JobQueue.enqueue).toHaveBeenCalledWith("workflow_step", {
            runId: "run-1",
            nodeId: "node-2",
        }, expect.any(Object));
    });

    it("should follow the true branch of a condition node", async () => {
        const mockRun = {
            id: "run-2",
            status: "RUNNING",
            entityId: "lead-1",
            context: {},
            workflow: {
                teamId: "team-1",
                nodes: [
                    { id: "node-1", type: "condition", data: { type: "REPLIED" } },
                    { id: "true-node", type: "action", data: { label: "Happy path" } },
                    { id: "false-node", type: "action", data: { label: "Follow up" } },
                ],
                edges: [
                    { source: "node-1", target: "true-node", sourceHandle: "true" },
                    { source: "node-1", target: "false-node", sourceHandle: "false" },
                ],
            },
        };

        (prisma.workflowRun.findUnique as Mock).mockResolvedValue(mockRun);
        (prisma.lead.findFirst as Mock).mockResolvedValue({ id: "lead-1", status: "replied" });

        await WorkflowService.processNode("run-2", "node-1");

        // Verify true node was enqueued
        expect(JobQueue.enqueue).toHaveBeenCalledWith("workflow_step", {
            runId: "run-2",
            nodeId: "true-node",
        }, expect.any(Object));
        expect(prisma.lead.findFirst).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
        });
    });

    it("startWorkflow rejects foreign leadId (IDOR protection)", async () => {
        (prisma.workflow.findUnique as Mock).mockResolvedValue({
            id: "wf-1",
            teamId: "team-1",
            isActive: true,
            nodes: [{ id: "n1", type: "input" }],
        });
        (prisma.lead.findFirst as Mock).mockResolvedValue(null);

        await expect(
            WorkflowService.startWorkflow("wf-1", "lead-foreign", "team-1")
        ).rejects.toThrow(/Lead not found or does not belong to team/);

        expect(prisma.lead.findFirst).toHaveBeenCalledWith({
            where: { id: "lead-foreign", teamId: "team-1" },
            select: { id: true },
        });
        expect(prisma.workflowRun.create).not.toHaveBeenCalled();
    });
});
