import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCtx, mockEndpoint } = vi.hoisted(() => ({ mockCtx: vi.fn(), mockEndpoint: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockCtx }));
vi.mock("@/lib/edgeRuntime", () => ({ getConfiguredEdgeRuntimeEndpoint: mockEndpoint }));

import { POST } from "./route";

beforeEach(() => {
    vi.restoreAllMocks();
    mockCtx.mockResolvedValue({ teamId: "t1" });
    mockEndpoint.mockReturnValue("http://edge.test");
});

describe("POST /edge/test-score", () => {
    it("rejects callers without a team", async () => {
        mockCtx.mockResolvedValue({});
        expect((await POST()).status).toBe(401);
    });

    it("returns the score and sends only the fixed sample text", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ score: 72 })));
        const res = await POST();
        expect((await res.json()).data.score).toBe(72);
        expect(String(spy.mock.calls[0]![0])).toBe("http://edge.test/v1/score_intent");
        expect(JSON.parse((spy.mock.calls[0]![1] as any).body).text).toBe("They asked for pricing and a demo this week.");
    });

    it("reports an error when the node refuses", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 503 }));
        const res = await POST();
        expect(res.status).toBe(502);
        expect((await res.json()).success).toBe(false);
    });
});
