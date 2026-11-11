import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        blindIndex: {
            upsert: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

describe("BlindIndexService", () => {
    const saved = { blind: process.env["BLIND_INDEX_KEY"], enc: process.env["ENCRYPTION_KEY"] };

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env["BLIND_INDEX_KEY"];
        process.env["ENCRYPTION_KEY"] = "test-encryption-key-material";
    });

    afterEach(() => {
        if (saved.blind === undefined) delete process.env["BLIND_INDEX_KEY"];
        else process.env["BLIND_INDEX_KEY"] = saved.blind;
        if (saved.enc === undefined) delete process.env["ENCRYPTION_KEY"];
        else process.env["ENCRYPTION_KEY"] = saved.enc;
    });

    describe("computeHash", () => {
        it("computes deterministic HMAC-SHA256 hashes for the same team and field", async () => {
            const { BlindIndexService } = await import("@/lib/blindIndexService");

            const hash1 = BlindIndexService.computeHash("team-1", "email", "john.doe@example.com");
            const hash2 = BlindIndexService.computeHash("team-1", "email", "  JOHN.DOE@EXAMPLE.COM  ");

            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA256 hex string
        });

        it("produces different hashes for different teams (tenant isolation)", async () => {
            const { BlindIndexService } = await import("@/lib/blindIndexService");

            const hashTeamA = BlindIndexService.computeHash("team-A", "email", "john.doe@example.com");
            const hashTeamB = BlindIndexService.computeHash("team-B", "email", "john.doe@example.com");

            expect(hashTeamA).not.toBe(hashTeamB);
        });

        it("throws if teamId or fieldName is missing", async () => {
            const { BlindIndexService } = await import("@/lib/blindIndexService");

            expect(() => BlindIndexService.computeHash("", "email", "test@example.com")).toThrow();
        });

        describe("key material", () => {
            it("refuses to hash when neither BLIND_INDEX_KEY nor ENCRYPTION_KEY is set", async () => {
                delete process.env["BLIND_INDEX_KEY"];
                delete process.env["ENCRYPTION_KEY"];
                const { BlindIndexService } = await import("@/lib/blindIndexService");

                expect(() => BlindIndexService.computeHash("team-1", "email", "a@b.com")).toThrow(/BLIND_INDEX_KEY|ENCRYPTION_KEY/);
            });

            it("prefers BLIND_INDEX_KEY and falls back to ENCRYPTION_KEY", async () => {
                const { BlindIndexService } = await import("@/lib/blindIndexService");

                delete process.env["BLIND_INDEX_KEY"];
                process.env["ENCRYPTION_KEY"] = "enc-key-material";
                const withEncryptionKey = BlindIndexService.computeHash("team-1", "email", "a@b.com");

                process.env["BLIND_INDEX_KEY"] = "dedicated-key-material";
                const withDedicatedKey = BlindIndexService.computeHash("team-1", "email", "a@b.com");

                expect(withEncryptionKey).toHaveLength(64);
                expect(withDedicatedKey).toHaveLength(64);
                expect(withDedicatedKey).not.toBe(withEncryptionKey);
            });
        });
    });

    describe("createBlindIndex", () => {
        it("upserts blind index record with computed hash", async () => {
            mockPrisma.blindIndex.upsert.mockResolvedValue({ id: "bi-1" });

            const { BlindIndexService } = await import("@/lib/blindIndexService");
            const result = await BlindIndexService.createBlindIndex({
                teamId: "team-1",
                entityType: "LandingLead",
                entityId: "lead-1",
                fieldName: "email",
                plaintext: "lead@acme.com",
            });

            expect(result).toEqual({ id: "bi-1" });
            expect(mockPrisma.blindIndex.upsert).toHaveBeenCalledWith({
                where: {
                    teamId_entityType_entityId_fieldName: {
                        teamId: "team-1",
                        entityType: "LandingLead",
                        entityId: "lead-1",
                        fieldName: "email",
                    },
                },
                update: {
                    indexHash: expect.any(String),
                },
                create: {
                    teamId: "team-1",
                    entityType: "LandingLead",
                    entityId: "lead-1",
                    fieldName: "email",
                    indexHash: expect.any(String),
                },
            });
        });

        it("returns null if plaintext is empty", async () => {
            const { BlindIndexService } = await import("@/lib/blindIndexService");
            const result = await BlindIndexService.createBlindIndex({
                teamId: "team-1",
                entityType: "LandingLead",
                entityId: "lead-1",
                fieldName: "email",
                plaintext: "",
            });

            expect(result).toBeNull();
            expect(mockPrisma.blindIndex.upsert).not.toHaveBeenCalled();
        });
    });

    describe("lookupByBlindIndex", () => {
        it("returns matched entityIds", async () => {
            mockPrisma.blindIndex.findMany.mockResolvedValue([
                { entityId: "lead-1" },
                { entityId: "lead-2" },
            ]);

            const { BlindIndexService } = await import("@/lib/blindIndexService");
            const ids = await BlindIndexService.lookupByBlindIndex(
                "team-1",
                "LandingLead",
                "email",
                "lead@acme.com"
            );

            expect(ids).toEqual(["lead-1", "lead-2"]);
            expect(mockPrisma.blindIndex.findMany).toHaveBeenCalledWith({
                where: {
                    teamId: "team-1",
                    entityType: "LandingLead",
                    fieldName: "email",
                    indexHash: expect.any(String),
                },
                select: {
                    entityId: true,
                },
            });
        });

        it("returns empty array if plaintext is empty", async () => {
            const { BlindIndexService } = await import("@/lib/blindIndexService");
            const ids = await BlindIndexService.lookupByBlindIndex(
                "team-1",
                "LandingLead",
                "email",
                ""
            );

            expect(ids).toEqual([]);
            expect(mockPrisma.blindIndex.findMany).not.toHaveBeenCalled();
        });
    });
});
