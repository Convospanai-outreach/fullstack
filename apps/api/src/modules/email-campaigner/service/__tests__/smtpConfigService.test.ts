import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_ENCRYPTION_KEY = "a".repeat(64); // 32-byte hex key required by aes-256-gcm

vi.mock("@/lib/db", () => ({
    prisma: {
        team: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";

describe("smtpConfigService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // ENCRYPTION_KEY is read once at module load time, so it must be stubbed
        // before the module's first dynamic import below (module caching then
        // keeps this same value for the rest of the suite).
        vi.stubEnv("ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
    });

    describe("getSmtpConfigRedacted", () => {
        it("returns null for an empty teamId without querying Prisma", async () => {
            const { getSmtpConfigRedacted } = await import("../smtpConfigService");

            const result = await getSmtpConfigRedacted("");

            expect(result).toBeNull();
            expect(prisma.team.findUnique).not.toHaveBeenCalled();
        });

        it("returns null when the team has no stored smtp config", async () => {
            (prisma.team.findUnique as any).mockResolvedValue({ aiConfig: {} });
            const { getSmtpConfigRedacted } = await import("../smtpConfigService");

            const result = await getSmtpConfigRedacted("team-1");

            expect(prisma.team.findUnique).toHaveBeenCalledWith({
                where: { id: "team-1" },
                select: { aiConfig: true },
            });
            expect(result).toBeNull();
        });

        it("never includes the password field, even if present on the stored record", async () => {
            (prisma.team.findUnique as any).mockResolvedValue({
                aiConfig: {
                    smtpConfig: {
                        host: "smtp.example.com",
                        port: 587,
                        secure: false,
                        user: "user@example.com",
                        fromName: "Acme",
                        fromEmail: "noreply@example.com",
                        password: { v: 1, cipher: "x", iv: "y", tag: "z" },
                    },
                },
            });
            const { getSmtpConfigRedacted } = await import("../smtpConfigService");

            const result = await getSmtpConfigRedacted("team-1");

            expect(result).toEqual({
                host: "smtp.example.com",
                port: 587,
                secure: false,
                user: "user@example.com",
                fromName: "Acme",
                fromEmail: "noreply@example.com",
            });
            expect(result).not.toHaveProperty("password");
        });
    });

    describe("saveSmtpConfig / getSmtpConfig round-trip", () => {
        it("encrypts the password on save and decrypts it back on read, scoped to the team", async () => {
            let storedAiConfig: any = {};
            (prisma.team.findUnique as any).mockImplementation(() => Promise.resolve({ aiConfig: storedAiConfig }));
            (prisma.team.update as any).mockImplementation(({ data }: any) => {
                storedAiConfig = data.aiConfig;
                return Promise.resolve({});
            });

            const { saveSmtpConfig, getSmtpConfig } = await import("../smtpConfigService");

            await saveSmtpConfig("team-1", {
                host: "smtp.example.com",
                port: 587,
                secure: false,
                user: "user@example.com",
                password: "super-secret",
                fromName: "Acme",
                fromEmail: "noreply@example.com",
            });

            expect(prisma.team.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: "team-1" } })
            );
            // The password must never be stored in plaintext
            expect(JSON.stringify(storedAiConfig)).not.toContain("super-secret");

            const config = await getSmtpConfig("team-1");

            expect(config.password).toBe("super-secret");
            expect(config.host).toBe("smtp.example.com");
        });
    });

    describe("deleteSmtpConfig", () => {
        it("removes only the smtpConfig key, scoped to the team", async () => {
            (prisma.team.findUnique as any).mockResolvedValue({
                aiConfig: { smtpConfig: { host: "smtp.example.com" }, otherSetting: true },
            });
            (prisma.team.update as any).mockResolvedValue({});
            const { deleteSmtpConfig } = await import("../smtpConfigService");

            await deleteSmtpConfig("team-1");

            expect(prisma.team.update).toHaveBeenCalledWith({
                where: { id: "team-1" },
                data: { aiConfig: { otherSetting: true } },
            });
        });
    });
});
