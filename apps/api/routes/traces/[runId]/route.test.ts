import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        workflowRun: { findFirst: vi.fn() },
        aiTrace: { findMany: vi.fn() },
    },
}));

import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

function getRequest() {
    return new Request("http://localhost:3001/api/traces/run-1");
}

describe("GET /api/traces/[runId]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("rejects an unauthenticated caller", async () => {
        (getCurrentContext as any).mockResolvedValue({ userId: null, teamId: null });

        const response = await GET(getRequest(), { params: Promise.resolve({ runId: "run-1" }) });

        expect(response.status).toBe(401);
        expect(prisma.aiTrace.findMany).not.toHaveBeenCalled();
    });

    it("refuses to return traces for a run whose workflow belongs to another team", async () => {
        (prisma.workflowRun.findFirst as any).mockResolvedValue(null);

        const response = await GET(getRequest(), { params: Promise.resolve({ runId: "run-from-team-b" }) });

        expect(prisma.workflowRun.findFirst).toHaveBeenCalledWith({
            where: { id: "run-from-team-b", workflow: { teamId: "team-a" } },
            select: { id: true },
        });
        expect(prisma.aiTrace.findMany).not.toHaveBeenCalled();
        expect(response.status).toBe(404);
    });

    it("returns traces for a run belonging to the caller's team", async () => {
        (prisma.workflowRun.findFirst as any).mockResolvedValue({ id: "run-1" });
        (prisma.aiTrace.findMany as any).mockResolvedValue([
            { stepName: "step-1", reasoning: "thinking", input: null, output: null, latency: 10, tokens: 5 },
        ]);

        const response = await GET(getRequest(), { params: Promise.resolve({ runId: "run-1" }) });

        expect(response.status).toBe(200);
    });
});
