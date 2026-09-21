import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateExtensionAuth = vi.fn();
const mockJobUpdateMany = vi.fn();
const mockJobFindFirst = vi.fn();
const mockSystemEventCreate = vi.fn();

vi.mock("../../_lib/auth", () => ({
    validateExtensionAuth: mockValidateExtensionAuth
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        job: {
            updateMany: mockJobUpdateMany,
            findFirst: mockJobFindFirst
        },
        systemEvent: {
            create: mockSystemEventCreate
        }
    }
}));

function authAs(teamIds: string[]) {
    mockValidateExtensionAuth.mockResolvedValue({
        ok: true,
        user: { id: "user-1", email: "u@example.com", name: "User", memberships: teamIds.map((teamId) => ({ teamId })) },
        teamIds
    });
}

function postReq(body: unknown) {
    return new Request("http://localhost/api/extension/tasks/result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    }) as any;
}

describe("extension tasks/result route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSystemEventCreate.mockResolvedValue({ id: "event-1" });
        authAs(["team-a"]);
    });

    it("records the result event and closes the job as completed on SUCCESS", async () => {
        mockJobUpdateMany.mockResolvedValue({ count: 1 });
        const { POST } = await import("./route");
        const res = await POST(postReq({ taskId: "job-1", type: "INSERT_DRAFT", status: "SUCCESS", result: { inserted: true } }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({ ok: true, taskId: "job-1", status: "completed" });
        expect(mockSystemEventCreate).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ name: "EXTENSION_TASK_RESULT", teamId: "team-a" }) })
        );
        const update = mockJobUpdateMany.mock.calls[0][0];
        expect(update.where).toEqual(expect.objectContaining({ id: "job-1", teamId: "team-a" }));
        expect(update.data.status).toBe("completed");
    });

    it("closes the job as failed and stores the error on ERROR", async () => {
        mockJobUpdateMany.mockResolvedValue({ count: 1 });
        const { POST } = await import("./route");
        const res = await POST(postReq({ taskId: "job-1", type: "OPEN_PROFILE", status: "ERROR", error: "tab closed" }));
        const body = await res.json();

        expect(body.status).toBe("failed");
        expect(mockJobUpdateMany.mock.calls[0][0].data.error).toBe("tab closed");
    });

    it("rejects an unsupported task type", async () => {
        const { POST } = await import("./route");
        const res = await POST(postReq({ taskId: "job-1", type: "DELETE_ACCOUNT", status: "SUCCESS" }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("INVALID_TASK_TYPE");
        expect(mockJobUpdateMany).not.toHaveBeenCalled();
    });

    it("rejects an unsupported status", async () => {
        const { POST } = await import("./route");
        const res = await POST(postReq({ taskId: "job-1", type: "OPEN_PROFILE", status: "MAYBE" }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("INVALID_TASK_STATUS");
    });

    it("records a result with no taskId without touching a job", async () => {
        const { POST } = await import("./route");
        const res = await POST(postReq({ type: "LOG_MANUAL_LINKEDIN_ACTION", status: "SUCCESS" }));
        const body = await res.json();
        expect(body).toEqual({ ok: true, status: "recorded" });
        expect(mockJobUpdateMany).not.toHaveBeenCalled();
    });

    it("404s when the taskId does not belong to the team", async () => {
        mockJobUpdateMany.mockResolvedValue({ count: 0 });
        mockJobFindFirst.mockResolvedValue(null);
        const { POST } = await import("./route");
        const res = await POST(postReq({ taskId: "other-team-job", type: "OPEN_PROFILE", status: "SUCCESS" }));
        expect(res.status).toBe(404);
        expect((await res.json()).code).toBe("TASK_NOT_FOUND");
    });
});
