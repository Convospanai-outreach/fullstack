import { beforeEach, describe, expect, it, vi } from "vitest";

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
    beforeEach(() => {
        vi.clearAllMocks();
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
