import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCtx, mockEndpoint } = vi.hoisted(() => ({ mockCtx: vi.fn(), mockEndpoint: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockCtx }));
vi.mock("@/lib/edgeRuntime", () => ({ getConfiguredEdgeRuntimeEndpoint: mockEndpoint }));

import { GET } from "./route";

beforeEach(() => {
    vi.restoreAllMocks();
    mockCtx.mockResolvedValue({ teamId: "t1" });
    mockEndpoint.mockReturnValue("http://edge.test");
});

describe("GET /edge/details", () => {
    it("rejects callers without a team", async () => {
        mockCtx.mockResolvedValue({});
        expect((await GET()).status).toBe(401);
    });

    it("reports not reachable when no endpoint is configured", async () => {
        mockEndpoint.mockReturnValue(undefined);
        expect((await (await GET()).json()).data).toEqual({ reachable: false });
    });

    it("shortens the hardware id and maps capability flags", async () => {
        vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) =>
            new Response(JSON.stringify(String(url).endsWith("/health")
                ? { hardware_id: "550e8400-e29b-41d4-a716-446655440000", services: ["runtime"] }
                : { capabilities: { tokenize: true, classify: true, generate: false, execute: false } })));
        const { data } = await (await GET()).json();
        expect(data.hardwareId).toBe("550e8400…0000");
        expect(data.reachable).toBe(true);
        expect(data.capabilities).toEqual({ tokenize: true, classify: true, generate: false, execute: false });
    });

    it("is not reachable when the node does not answer", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));
        const { data } = await (await GET()).json();
        expect(data.reachable).toBe(false);
        expect(data.hardwareId).toBeNull();
    });
});
