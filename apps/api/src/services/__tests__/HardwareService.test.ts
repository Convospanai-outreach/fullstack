import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
    edgeNode: { findUnique: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

const originalFetch = global.fetch;

describe("HardwareService multi-tenant routing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("routes to the team's own paired edge node when one exists and isn't revoked", async () => {
        mockPrisma.edgeNode.findUnique.mockResolvedValue({ ipAddress: "http://192.168.1.50:8000/", revokedAt: null });
        (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ status: "ONLINE", hardware_id: "sig" }) });

        const { HardwareService } = await import("../HardwareService");
        await HardwareService.getStatus("team-1");

        expect(mockPrisma.edgeNode.findUnique).toHaveBeenCalledWith({
            where: { teamId: "team-1" },
            select: { ipAddress: true, revokedAt: true },
        });
        expect((global.fetch as any).mock.calls[0][0]).toBe("http://192.168.1.50:8000/health");
    });

    it("falls back to the global edge endpoint when the team has no paired node", async () => {
        mockPrisma.edgeNode.findUnique.mockResolvedValue(null);
        (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ status: "ONLINE", hardware_id: "sig" }) });

        const { HardwareService } = await import("../HardwareService");
        await HardwareService.getStatus("team-2");

        expect((global.fetch as any).mock.calls[0][0]).toBe("http://localhost:8000/health");
    });

    it("falls back to the global edge endpoint when the team's node is revoked", async () => {
        mockPrisma.edgeNode.findUnique.mockResolvedValue({ ipAddress: "http://192.168.1.50:8000", revokedAt: new Date() });
        (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ status: "ONLINE", hardware_id: "sig" }) });

        const { HardwareService } = await import("../HardwareService");
        await HardwareService.getStatus("team-3");

        expect((global.fetch as any).mock.calls[0][0]).toBe("http://localhost:8000/health");
    });

    it("falls back to the global edge endpoint when no teamId is given (e.g. boot-time verification)", async () => {
        (global.fetch as any).mockResolvedValue({ ok: true, json: async () => ({ status: "ONLINE", hardware_id: "sig" }) });

        const { HardwareService } = await import("../HardwareService");
        await HardwareService.verifyHardwareIdentity();

        expect(mockPrisma.edgeNode.findUnique).not.toHaveBeenCalled();
        expect((global.fetch as any).mock.calls[0][0]).toBe("http://localhost:8000/health");
    });

    it("routes sanitize/search/critique/reIdentify to the team's own node", async () => {
        mockPrisma.edgeNode.findUnique.mockResolvedValue({ ipAddress: "http://10.0.0.5:8000", revokedAt: null });
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ sanitized_text: "x", token_map_id: "t", stats: {}, results: [], status: "APPROVED", score: 1, original: "y" }),
        });

        const { HardwareService } = await import("../HardwareService");
        await HardwareService.sanitize("hello", "team-1");
        await HardwareService.search("q", "team-1");
        await HardwareService.critique("hello", "ctx", "team-1");
        await HardwareService.reIdentify("[MASKED]", "support", "team-1");

        const urls = (global.fetch as any).mock.calls.map((c: any[]) => c[0]);
        expect(urls).toEqual([
            "http://10.0.0.5:8000/v1/sanitize",
            "http://10.0.0.5:8000/search",
            "http://10.0.0.5:8000/v1/critique",
            "http://10.0.0.5:8000/v1/reidentify",
        ]);
    });
});
