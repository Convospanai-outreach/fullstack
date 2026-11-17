import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreateTask, mockGetCurrentContext, MockPipelineRequestError } = vi.hoisted(() => ({
    mockCreateTask: vi.fn(),
    mockGetCurrentContext: vi.fn(),
    MockPipelineRequestError: class extends Error {
        constructor(message: string, readonly status: 404 | 409) { super(message); }
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/modules/analytics/service/PipelineService", () => ({
    PipelineRequestError: MockPipelineRequestError,
    PipelineService: { createTask: mockCreateTask, getTasks: vi.fn() },
}));

import { POST } from "./route";

const post = (body: unknown) => new Request("http://localhost/pipeline/tasks", { method: "POST", body: JSON.stringify(body) }) as any;

describe("POST /pipeline/tasks", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("creates a task for the caller's own workspace", async () => {
        mockCreateTask.mockResolvedValue({ id: "task-1" });
        const res = await POST(post({ title: "Call back", leadId: "lead-1" }));

        expect(res.status).toBe(200);
        expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", teamId: "team-1", leadId: "lead-1" }));
    });

    // An unknown lead is the caller's mistake; MCP agents read a 5xx as "outcome uncertain".
    it("answers an unknown or foreign lead with 404, not 500", async () => {
        mockCreateTask.mockRejectedValue(new MockPipelineRequestError("Lead not found", 404));
        const res = await POST(post({ title: "Call back", leadId: "missing" }));

        expect(res.status).toBe(404);
        expect((await res.json()).error).toBe("Lead not found");
    });

    it("still reports unexpected failures as 500", async () => {
        mockCreateTask.mockRejectedValue(new Error("database down"));
        expect((await POST(post({ title: "x" }))).status).toBe(500);
    });
});
