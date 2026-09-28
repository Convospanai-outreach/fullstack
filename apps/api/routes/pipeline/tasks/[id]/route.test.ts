import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContextFromRequest } = vi.hoisted(() => ({
    mockPrisma: {
        task: { findFirst: vi.fn(), updateMany: vi.fn() },
    },
    mockGetCurrentContextFromRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));

import { PATCH } from "./route";

function patchRequest(body: unknown) {
    return new Request("http://localhost/pipeline/tasks/task-1", {
        method: "PATCH",
        body: JSON.stringify(body),
    }) as any;
}

function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("PATCH /pipeline/tasks/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects an unauthenticated caller before touching the task", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });

        const res = await PATCH(patchRequest({ status: "DONE" }), ctx("task-1"));

        expect(res.status).toBe(401);
        expect(mockPrisma.task.findFirst).not.toHaveBeenCalled();
    });

    it("does not let a caller update another team's task", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.task.findFirst.mockResolvedValue(null);

        const res = await PATCH(patchRequest({ status: "DONE" }), ctx("task-from-team-b"));

        expect(res.status).toBe(404);
        expect(mockPrisma.task.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "task-from-team-b", teamId: "team-1" } })
        );
        expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
    });

    it("updates a task belonging to the caller's own team, scoping the write itself too", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.task.findFirst
            .mockResolvedValueOnce({ id: "task-1", teamId: "team-1" })
            .mockResolvedValueOnce({ id: "task-1", teamId: "team-1", status: "DONE" });
        mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });

        const res = await PATCH(patchRequest({ status: "DONE" }), ctx("task-1"));

        expect(res.status).toBe(200);
        expect(mockPrisma.task.updateMany).toHaveBeenCalledWith({
            where: { id: "task-1", teamId: "team-1" },
            data: { status: "DONE" },
        });
    });
});
