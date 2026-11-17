import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ctx: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: m.ctx }));
vi.mock("@/lib/leadWorkflowBatch", () => ({ loadLeadWorkflows: m.load }));

import { GET } from "./route";

const call = (query: string) => GET(new Request(`http://x/leads/workflow${query}`));

beforeEach(() => {
    vi.resetAllMocks();
    m.ctx.mockResolvedValue({ userId: "u1", teamId: "t1" });
    m.load.mockResolvedValue(new Map());
});

describe("GET /leads/workflow", () => {
    it("rejects unauthenticated callers", async () => {
        m.ctx.mockResolvedValue({});
        expect((await call("?ids=a")).status).toBe(401);
    });

    it("returns nothing without ids and does not query", async () => {
        expect((await (await call("")).json()).data).toEqual({});
        expect(m.load).not.toHaveBeenCalled();
    });

    it("refuses more than 100 leads", async () => {
        const ids = Array.from({ length: 101 }, (_, i) => `l${i}`).join(",");
        expect((await call(`?ids=${ids}`)).status).toBe(400);
    });

    it("loads the caller's team only and returns steps by lead id", async () => {
        m.load.mockResolvedValue(new Map([["a", { steps: [{ key: "signal", label: "Signal Review", state: "done", detail: null, gated: false, rule: "r" }], approval: null }]]));
        const { data } = await (await call("?ids=a,a,b")).json();
        expect(m.load).toHaveBeenCalledWith("t1", ["a", "b"]);
        expect(data).toEqual({ a: [{ key: "signal", label: "Signal Review", state: "done", detail: null }] });
    });
});
