import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockMcpManager } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockMcpManager: {
        initialize: vi.fn().mockResolvedValue(undefined),
        callTool: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/mcp/McpManager", () => ({ mcpManager: mockMcpManager }));

function postRequest(body: unknown) {
    return new Request("http://localhost/api/mcp/call", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /api/mcp/call - teamId must come from a real session, never the request", () => {
    beforeEach(() => vi.clearAllMocks());

    it("rejects an unauthenticated caller instead of trusting a caller-supplied teamId", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ name: "read_app_learning_memories", teamId: "victim-team" }));

        expect(response.status).toBe(401);
        expect(mockMcpManager.callTool).not.toHaveBeenCalled();
    });

    it("ignores a caller-supplied teamId and always uses the session's real team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "real-team" });
        mockMcpManager.callTool.mockResolvedValue({ ok: true });
        const { POST } = await import("./route");

        await POST(postRequest({ name: "read_app_learning_memories", args: {}, teamId: "victim-team" }));

        expect(mockMcpManager.callTool).toHaveBeenCalledWith(
            "read_app_learning_memories",
            {},
            expect.objectContaining({ teamId: "real-team" })
        );
    });
});
