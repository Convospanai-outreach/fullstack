import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockJobCreate, mockJobFindUnique } = vi.hoisted(() => ({
    mockJobCreate: vi.fn(),
    mockJobFindUnique: vi.fn()
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        job: { create: mockJobCreate, findUnique: mockJobFindUnique }
    }
}));

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { enqueueExtensionTask, EXTENSION_TASK_STATUS } from "../extension-bridge";

describe("enqueueExtensionTask", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates a Job in the extension status lane (not a server-dequeueable status) with the task type set", async () => {
        mockJobCreate.mockResolvedValue({ id: "job-1" });

        const res = await enqueueExtensionTask({
            teamId: "team-a",
            type: "OPEN_PROFILE",
            payload: { profileUrl: "https://www.linkedin.com/in/x/" },
            idempotencyKey: "ext_openprofile_run-1"
        });

        expect(res).toEqual({ id: "job-1", created: true });
        const data = mockJobCreate.mock.calls[0][0].data;
        expect(data.status).toBe(EXTENSION_TASK_STATUS);
        expect(EXTENSION_TASK_STATUS).not.toBe("queued");
        expect(EXTENSION_TASK_STATUS).not.toBe("pending");
        // Both columns are set so tasks/pending's (type OR taskType) filter matches.
        expect(data.type).toBe("OPEN_PROFILE");
        expect(data.taskType).toBe("OPEN_PROFILE");
        expect(data.teamId).toBe("team-a");
        expect(data.idempotencyKey).toBe("ext_openprofile_run-1");
    });

    it("reuses the existing task when the idempotencyKey collides (P2002) instead of throwing", async () => {
        mockJobCreate.mockRejectedValue({ code: "P2002" });
        mockJobFindUnique.mockResolvedValue({ id: "existing-job" });

        const res = await enqueueExtensionTask({
            teamId: "team-a",
            type: "OPEN_PROFILE",
            payload: {},
            idempotencyKey: "ext_openprofile_run-1"
        });

        expect(res).toEqual({ id: "existing-job", created: false });
        expect(mockJobFindUnique).toHaveBeenCalledWith({
            where: { idempotencyKey: "ext_openprofile_run-1" },
            select: { id: true }
        });
    });

    it("rethrows a non-idempotency create error", async () => {
        mockJobCreate.mockRejectedValue(new Error("db down"));
        await expect(
            enqueueExtensionTask({ teamId: "team-a", type: "OPEN_PROFILE", payload: {} })
        ).rejects.toThrow("db down");
    });
});
