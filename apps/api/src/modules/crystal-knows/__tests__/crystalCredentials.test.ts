import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        team: { findUnique: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

import {
    getTeamCrystalApiKey,
    teamHasCrystalApiKey,
    verifyCrystalApiKey,
    setTeamCrystalApiKey,
    clearTeamCrystalApiKey,
} from "../crystalCredentials";

describe("crystalCredentials", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["ENCRYPTION_KEY"] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        vi.stubGlobal("fetch", vi.fn());
    });

    it("round-trips a key through set -> encrypted storage -> get", async () => {
        let stored: any = null;
        mockPrisma.team.update.mockImplementation(async ({ data }: any) => {
            stored = data.crystalApiKeyEnc;
        });
        mockPrisma.team.findUnique.mockImplementation(async () => ({ crystalApiKeyEnc: stored }));

        await setTeamCrystalApiKey("team-1", "sk-crystal-abc123");
        expect(stored).toMatchObject({ v: 1 });

        const decrypted = await getTeamCrystalApiKey("team-1");
        expect(decrypted).toBe("sk-crystal-abc123");
    });

    it("reports hasKey false when no key is stored", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({ crystalApiKeyEnc: null });
        expect(await teamHasCrystalApiKey("team-1")).toBe(false);
    });

    it("clears the stored key", async () => {
        await clearTeamCrystalApiKey("team-1");
        expect(mockPrisma.team.update).toHaveBeenCalledWith({
            where: { id: "team-1" },
            data: expect.objectContaining({ crystalApiKeyConfiguredAt: null }),
        });
    });

    it("verifyCrystalApiKey treats a 404 (not found) as a valid key", async () => {
        (fetch as any).mockResolvedValue({ status: 404, ok: false });
        const result = await verifyCrystalApiKey("sk-good");
        expect(result.ok).toBe(true);
    });

    it("verifyCrystalApiKey treats a 401 as an invalid key", async () => {
        (fetch as any).mockResolvedValue({ status: 401, ok: false });
        const result = await verifyCrystalApiKey("sk-bad");
        expect(result.ok).toBe(false);
    });
});
