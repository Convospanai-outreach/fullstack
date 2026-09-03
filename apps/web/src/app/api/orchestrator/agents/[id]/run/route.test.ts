import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockEnqueue, mockEnforcePolicy, mockCheckLimits, mockAudit } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        agent: { updateMany: vi.fn() },
        activity: { create: vi.fn() },
    },
    mockEnqueue: vi.fn(),
    mockEnforcePolicy: vi.fn(),
    mockCheckLimits: vi.fn(),
    mockAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: mockEnforcePolicy }));
vi.mock("@/lib/governance/limits", () => ({ checkLimits: mockCheckLimits }));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));

import { POST } from "./route";

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("POST /orchestrator/agents/[id]/run - double-run guard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckLimits.mockResolvedValue(undefined);
        mockEnforcePolicy.mockResolvedValue(true);
        mockPrisma.activity.create.mockResolvedValue({});
        mockEnqueue.mockResolvedValue({ id: "job-1" });
        mockAudit.mockResolvedValue(undefined);
    });

    it("claims the agent and enqueues a run when it wasn't already running", async () => {
        mockPrisma.agent.updateMany.mockResolvedValue({ count: 1 });

        const res = await POST(new Request("http://localhost") as any, paramsFor("agent-1"));

        expect(res.status).toBe(200);
        expect(mockPrisma.agent.updateMany).toHaveBeenCalledWith({
            where: { id: "agent-1", status: { not: "running" } },
            data: { status: "running" },
        });
        expect(mockEnqueue).toHaveBeenCalledTimes(1);
    });

    it("rejects a second concurrent run instead of double-enqueueing (this used to update unconditionally)", async () => {
        mockPrisma.agent.updateMany.mockResolvedValue({ count: 0 });

        const res = await POST(new Request("http://localhost") as any, paramsFor("agent-1"));

        expect(res.status).toBe(409);
        expect(mockEnqueue).not.toHaveBeenCalled();
    });
});
