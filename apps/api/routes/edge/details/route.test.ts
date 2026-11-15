import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCtx, mockFind } = vi.hoisted(() => ({ mockCtx: vi.fn(), mockFind: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockCtx }));
vi.mock("@/lib/db", () => ({ prisma: { edgeNode: { findUnique: mockFind } } }));

import { GET } from "./route";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);
const node = (over: Record<string, unknown> = {}) => ({
    status: "ONLINE",
    attestationStatus: "TRUSTED",
    revokedAt: null,
    lastSeenAt: minutesAgo(1),
    hardwareFingerprintHash: "550e8400e29b41d4a716446655440000",
    hardwareId: "legacy",
    runtimeVersion: "1.2.3",
    capabilities: { tokenize: true, classify: true, generate: false },
    ...over,
});

beforeEach(() => {
    vi.resetAllMocks();
    mockCtx.mockResolvedValue({ teamId: "t1" });
});

describe("GET /edge/details (heartbeat based)", () => {
    it("rejects callers without a team", async () => {
        mockCtx.mockResolvedValue({});
        expect((await GET()).status).toBe(401);
    });

    it("reports not configured when no node is paired", async () => {
        mockFind.mockResolvedValue(null);
        expect((await (await GET()).json()).data).toEqual({ configured: false });
    });

    it("is green under 5 minutes, with a shortened id and capability flags", async () => {
        mockFind.mockResolvedValue(node());
        const { data } = await (await GET()).json();
        expect(data.state).toBe("green");
        expect(data.hardwareId).toBe("550e8400…0000");
        expect(data.capabilities).toEqual({ tokenize: true, classify: true, generate: false, execute: false });
    });

    it("is amber between 5 and 30 minutes and red beyond", async () => {
        mockFind.mockResolvedValue(node({ lastSeenAt: minutesAgo(12) }));
        expect((await (await GET()).json()).data.state).toBe("amber");
        mockFind.mockResolvedValue(node({ lastSeenAt: minutesAgo(45) }));
        expect((await (await GET()).json()).data.state).toBe("red");
    });

    it("is red when revoked, failed attestation, or never seen", async () => {
        mockFind.mockResolvedValue(node({ status: "REVOKED", revokedAt: new Date() }));
        expect((await (await GET()).json()).data).toMatchObject({ state: "red", reason: "revoked" });
        mockFind.mockResolvedValue(node({ attestationStatus: "FAILED" }));
        expect((await (await GET()).json()).data).toMatchObject({ state: "red", reason: "attestation_failed" });
        mockFind.mockResolvedValue(node({ lastSeenAt: null }));
        expect((await (await GET()).json()).data).toMatchObject({ state: "red", reason: "no_heartbeat" });
    });
});
