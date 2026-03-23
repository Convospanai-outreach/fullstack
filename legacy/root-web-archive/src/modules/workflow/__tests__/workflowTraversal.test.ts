import { vi, Mock } from 'vitest';
import { WorkflowService } from "@/lib/workflowService";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

vi.mock("@/lib/db", () => ({
    prisma: {
        workflowRun: {
            findUnique: vi.fn(),
            update: vi.fn(),
            create: vi.fn()
        },
        lead: {
            findUnique: vi.fn()
        }
    }
}));

vi.mock("@/lib/queue", () => ({
    JobQueue: {
        enqueue: vi.fn()
    }
}));

describe("WorkflowService DAG Traversal", () => {
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
                    { id: "node-2", type: "action", data: { actionType: "EMAIL" } }
                ],
                edges: [
                    { source: "node-1", target: "node-2" }
                ]
            }
        };

        (prisma.workflowRun.findUnique as Mock).mockResolvedValue(mockRun);

        await WorkflowService.processNode("run-1", "node-1");

        // Verify next node was enqueued
        expect(JobQueue.enqueue).toHaveBeenCalledWith("workflow_step", {
            runId: "run-1",
            nodeId: "node-2"
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
                    { id: "false-node", type: "action", data: { label: "Follow up" } }
                ],
                edges: [
                    { source: "node-1", target: "true-node", sourceHandle: "true" },
                    { source: "node-1", target: "false-node", sourceHandle: "false" }
                ]
            }
        };

        (prisma.workflowRun.findUnique as Mock).mockResolvedValue(mockRun);
        (prisma.lead.findUnique as Mock).mockResolvedValue({ id: "lead-1", status: "replied" });

        await WorkflowService.processNode("run-2", "node-1");

        // Verify true node was enqueued
        expect(JobQueue.enqueue).toHaveBeenCalledWith("workflow_step", {
            runId: "run-2",
            nodeId: "true-node"
        }, expect.any(Object));
    });
});
