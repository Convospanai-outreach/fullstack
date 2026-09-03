import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockSearch } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockSearch: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("../service/vectorStore", () => ({ vectorStore: { search: mockSearch } }));

import { POST } from "./query";

function postRequest(body: unknown) {
    return new Request("http://localhost/rag/query", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /rag/query", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSearch.mockResolvedValue([]);
    });

    it("rejects an unauthenticated caller before searching anything", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postRequest({ query: "hello" }));

        expect(res.status).toBe(401);
        expect(mockSearch).not.toHaveBeenCalled();
    });

    it("passes the caller's own teamId, not the client-supplied limit, into the teamId slot", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });

        await POST(postRequest({ query: "hello", limit: "team-b" }));

        expect(mockSearch).toHaveBeenCalledWith("hello", "team-a", "team-b");
    });
});
