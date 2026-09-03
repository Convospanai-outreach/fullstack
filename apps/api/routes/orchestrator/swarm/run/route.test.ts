import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockEnqueue, mockEnforcePolicy, mockCheckLimits, mockAudit } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn() },
        agent: { findFirst: vi.fn(), create: vi.fn() },
        agentTask: { create: vi.fn() },
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

function postRequest(body: unknown) {
    return new Request("http://localhost/api/orchestrator/swarm/run", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /orchestrator/swarm/run - rate limiting", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckLimits.mockResolvedValue(undefined);
        mockEnforcePolicy.mockResolvedValue(true);
        mockPrisma.agent.findFirst.mockResolvedValue({ id: "agent-1" });
        mockPrisma.agentTask.create.mockResolvedValue({ id: "task-1" });
        mockPrisma.activity.create.mockResolvedValue({});
        mockEnqueue.mockResolvedValue({ id: "job-1" });
        mockAudit.mockResolvedValue(undefined);
    });

    it("rejects a second swarm launch from the same team within the rate-limit window", async () => {
        const teamId = `team-rate-limit-${crypto.randomUUID()}`;
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId });

        const first = await POST(postRequest({ roles: ["Debugger"] }));
        expect(first.status).toBe(200);

        const second = await POST(postRequest({ roles: ["Debugger"] }));
        expect(second.status).toBe(429);
        // Only the first request's roles should have been launched (normalizeRoles always
        // adds "Frontend Integrator", so one successful launch enqueues 2 jobs here).
        expect(mockEnqueue).toHaveBeenCalledTimes(2);
    });

    it("allows a swarm launch from a different team even right after another team's launch", async () => {
        mockGetCurrentContext.mockResolvedValueOnce({ userId: "user-1", teamId: `team-a-${crypto.randomUUID()}` });
        await POST(postRequest({ roles: ["Debugger"] }));

        mockGetCurrentContext.mockResolvedValueOnce({ userId: "user-2", teamId: `team-b-${crypto.randomUUID()}` });
        const res = await POST(postRequest({ roles: ["Debugger"] }));

        expect(res.status).toBe(200);
    });
});
