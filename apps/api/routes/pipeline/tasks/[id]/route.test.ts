import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContextFromRequest, mockCompleteManualRun } = vi.hoisted(() => ({
    mockPrisma: {
        task: { findFirst: vi.fn(), updateMany: vi.fn() },
    },
    mockGetCurrentContextFromRequest: vi.fn(),
    mockCompleteManualRun: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetCurrentContextFromRequest }));
vi.mock("@/modules/email-campaigner/service/sequenceService", () => ({
    SequenceService: { completeManualRun: mockCompleteManualRun },
}));

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

    // roadmap 3.3 (S-10): any status/priority string was written through, and an
    // unparseable dueDate reached Prisma as Invalid Date.
    it("400s an unknown status or an invalid dueDate without writing", async () => {
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.task.findFirst.mockResolvedValue({ id: "task-1", teamId: "team-1", lead: null });
        mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });

        const badStatus = await PATCH(patchRequest({ status: "ARCHIVED" }), ctx("task-1"));
        const badDate = await PATCH(patchRequest({ dueDate: "not-a-date" }), ctx("task-1"));

        expect(badStatus.status).toBe(400);
        expect(badDate.status).toBe(400);
        expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
    });

    describe("a task a sequence step created", () => {
        const linked = { id: "task-1", teamId: "team-1", status: "TODO", sequenceStepRunId: "run-1" };

        beforeEach(() => {
            mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
            mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });
        });

        it("moves the sequence on when it is marked done", async () => {
            mockPrisma.task.findFirst.mockResolvedValue(linked);

            const res = await PATCH(patchRequest({ status: "DONE" }), ctx("task-1"));

            expect(res.status).toBe(200);
            expect(mockCompleteManualRun).toHaveBeenCalledWith("team-1", "run-1");
        });

        it.each([
            ["it is already done", { ...linked, status: "DONE" }, { status: "DONE" }],
            ["something else is edited", linked, { title: "Renamed" }],
            ["it is reopened", { ...linked, status: "DONE" }, { status: "TODO" }],
            ["the task was not created by a sequence", { ...linked, sequenceStepRunId: null }, { status: "DONE" }],
        ])("leaves the sequence alone when %s", async (_label, task, body) => {
            mockPrisma.task.findFirst.mockResolvedValue(task);

            await PATCH(patchRequest(body), ctx("task-1"));

            expect(mockCompleteManualRun).not.toHaveBeenCalled();
        });

        it("keeps the task open when the sequence could not be moved on, so it can be marked done again", async () => {
            mockPrisma.task.findFirst.mockResolvedValue(linked);
            mockCompleteManualRun.mockRejectedValueOnce(new Error("db down"));

            const res = await PATCH(patchRequest({ status: "DONE" }), ctx("task-1"));

            expect(res.status).toBe(500);
            expect(mockPrisma.task.updateMany).not.toHaveBeenCalled();
        });
    });
});
