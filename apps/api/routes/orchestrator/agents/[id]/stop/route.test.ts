import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockEnqueue, mockAudit } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        agent: { updateMany: vi.fn() },
        activity: { create: vi.fn() },
    },
    mockEnqueue: vi.fn(),
    mockAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));

import { POST } from "./route";

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("POST /orchestrator/agents/[id]/stop - team ownership guard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.activity.create.mockResolvedValue({});
        mockEnqueue.mockResolvedValue({ id: "job-1" });
        mockAudit.mockResolvedValue(undefined);
    });

    it("stops an agent owned by the caller's team", async () => {
        mockPrisma.agent.updateMany.mockResolvedValue({ count: 1 });

        const res = await POST(new Request("http://localhost") as any, paramsFor("agent-1"));

        expect(res.status).toBe(200);
        expect(mockPrisma.agent.updateMany).toHaveBeenCalledWith({
            where: { id: "agent-1", teamId: "team-1" },
            data: { status: "idle" },
        });
        expect(mockPrisma.activity.create).toHaveBeenCalledTimes(1);
    });

    it("returns 404 instead of stopping another team's agent (OPEN-187: update({ where: { id } }) had no teamId scope)", async () => {
        mockPrisma.agent.updateMany.mockResolvedValue({ count: 0 });

        const res = await POST(new Request("http://localhost") as any, paramsFor("agent-owned-by-another-team"));

        expect(res.status).toBe(404);
        expect(mockPrisma.activity.create).not.toHaveBeenCalled();
    });
});
