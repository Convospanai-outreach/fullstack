import { beforeEach, describe, expect, it, vi, beforeAll, afterAll, afterEach } from "vitest";

// These tests cover the guarded behavior, which is off unless the flag is set.
beforeEach(() => { vi.stubEnv("MAILBOX_REPUTATION_GUARD", "true"); });
afterEach(() => { vi.unstubAllEnvs(); });

const TEST_ENCRYPTION_KEY = "a".repeat(64); // 32-byte hex key required by aes-256-gcm

vi.mock("@/lib/db", () => ({
    prisma: {
        team: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        connectedMailbox: {
            findFirst: vi.fn(),
            findFirstOrThrow: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
            createMany: vi.fn(),
            update: vi.fn(),
        },
        auditLog: { create: vi.fn() },
        $queryRaw: vi.fn(),
        $transaction: vi.fn(),
    },
}));

vi.mock("@/lib/security/credentialVault", () => ({
    decryptCredential: vi.fn(),
    encryptCredential: vi.fn().mockResolvedValue({ v: 1, cipher: "fixture-cipher", iv: "fixture-iv", tag: "fixture-tag" }),
}));

vi.mock("@/lib/email/smtpClient", () => ({
    sendViaSMTP: vi.fn(),
}));

const { reserve, release } = vi.hoisted(() => ({
    reserve: vi.fn().mockResolvedValue({ ok: true }), release: vi.fn(),
}));
vi.mock("../googleMailboxService", () => ({ reserveMailboxSend: reserve, releaseMailboxSend: release }));

import { prisma } from "@/lib/db";
import { decryptCredential, encryptCredential } from "@/lib/security/credentialVault";
import { sendViaSMTP } from "@/lib/email/smtpClient";

describe("smtpConfigService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.$transaction).mockImplementation((work) => typeof work === "function" ? work(prisma as never) : Promise.resolve([]) as never);
        vi.mocked(prisma.connectedMailbox.findMany).mockResolvedValue([]);
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

    describe("sendViaSmtpMailbox", () => {
        it("returns a pre-dispatch failure with fallback allowed when the mailbox is not found", async () => {
            (prisma.connectedMailbox.findFirst as any).mockResolvedValue(null);
            const { sendViaSmtpMailbox } = await import("../smtpConfigService");

            const result = await sendViaSmtpMailbox({
                teamId: "team-1",
                mailboxId: "missing-mailbox",
                to: "lead@example.com",
                subject: "Hi",
                html: "<p>Hi</p>",
            });

            expect(result).toEqual({ success: false, error: "SMTP_MAILBOX_PRE_DISPATCH_FAILED", fallbackAllowed: true });
            expect(sendViaSMTP).not.toHaveBeenCalled();
        });

        it("returns a pre-dispatch failure when the credential fails to decrypt", async () => {
            (prisma.connectedMailbox.findFirst as any).mockResolvedValue({
                id: "mailbox-1",
                email: "sender@example.com",
                displayName: "Sender",
                metadata: { host: "smtp.example.com", port: 587, secure: false },
                encryptedAccessToken: { v: 1, cipher: "x", iv: "y", tag: "z" },
            });
            (decryptCredential as any).mockResolvedValue(undefined);
            const { sendViaSmtpMailbox } = await import("../smtpConfigService");

            const result = await sendViaSmtpMailbox({
                teamId: "team-1",
                mailboxId: "mailbox-1",
                to: "lead@example.com",
                subject: "Hi",
                html: "<p>Hi</p>",
            });

            expect(result).toEqual({ success: false, error: "SMTP_MAILBOX_PRE_DISPATCH_FAILED", fallbackAllowed: true });
            expect(sendViaSMTP).not.toHaveBeenCalled();
        });

        it("sends using the mailbox's own decrypted credentials and metadata host/port/secure", async () => {
            (prisma.connectedMailbox.findFirst as any).mockResolvedValue({
                id: "mailbox-1",
                email: "sender@example.com",
                displayName: "Sender Name",
                metadata: { host: "smtp.example.com", port: 465, secure: true },
                encryptedAccessToken: { v: 1, cipher: "x", iv: "y", tag: "z" },
            });
            (decryptCredential as any).mockResolvedValue("decrypted-password");
            (sendViaSMTP as any).mockResolvedValue({ success: true, messageId: "<msg-1@example.com>" });
            const { sendViaSmtpMailbox } = await import("../smtpConfigService");

            const result = await sendViaSmtpMailbox({
                teamId: "team-1",
                mailboxId: "mailbox-1",
                to: "lead@example.com",
                subject: "Hi",
                html: "<p>Hi</p>",
            });

            expect(sendViaSMTP).toHaveBeenCalledWith(
                {
                    host: "smtp.example.com",
                    port: 465,
                    secure: true,
                    user: "sender@example.com",
                    password: "decrypted-password",
                    fromName: "Sender Name",
                    fromEmail: "sender@example.com",
                },
                expect.objectContaining({ to: "lead@example.com", subject: "Hi", html: "<p>Hi</p>" })
            );
            expect(result).toEqual({
                success: true,
                deliveryProvider: "SMTP",
                messageId: "<msg-1@example.com>",
                mailboxId: "mailbox-1",
            });
        });

        it("never attempts SMTP or a fallback when reservation detects a sending hold", async () => {
            vi.mocked(prisma.connectedMailbox.findFirst).mockResolvedValue({
                id: "mailbox-1", email: "sender@example.test", metadata: { host: "smtp.example.test" },
            } as never);
            vi.mocked(decryptCredential).mockResolvedValue("test-fixture");
            reserve.mockResolvedValueOnce({ ok: false, reason: "MAILBOX_REPUTATION_HOLD" });
            const { sendViaSmtpMailbox } = await import("../smtpConfigService");
            await expect(sendViaSmtpMailbox({ teamId: "team-1", mailboxId: "mailbox-1", to: "recipient@example.test", subject: "Hi", html: "Hi" }))
                .resolves.toEqual({ success: false, error: "MAILBOX_REPUTATION_HOLD", fallbackAllowed: false });
            expect(sendViaSMTP).not.toHaveBeenCalled();
        });

        it("returns a fallback-allowed failure when the mailbox's own SMTP send fails", async () => {
            (prisma.connectedMailbox.findFirst as any).mockResolvedValue({
                id: "mailbox-1",
                email: "sender@example.com",
                displayName: "Sender",
                metadata: { host: "smtp.example.com", port: 587, secure: false },
                encryptedAccessToken: { v: 1, cipher: "x", iv: "y", tag: "z" },
            });
            (decryptCredential as any).mockResolvedValue("decrypted-password");
            (sendViaSMTP as any).mockResolvedValue({ success: false, error: "auth failed" });
            const { sendViaSmtpMailbox } = await import("../smtpConfigService");

            const result = await sendViaSmtpMailbox({
                teamId: "team-1",
                mailboxId: "mailbox-1",
                to: "lead@example.com",
                subject: "Hi",
                html: "<p>Hi</p>",
            });

            expect(result).toEqual({ success: false, error: "SMTP_MAILBOX_SEND_FAILED", fallbackAllowed: true });
        });
    });

    describe("automatic legacy SMTP mailbox conversion", () => {
        const legacy = {
            fromEmail: "Outreach@Example.test", fromName: "Outreach", user: "smtp-login",
            password: "fixture-value", host: "smtp.example.test", port: 587, secure: false,
        };

        it("creates one quota-bearing mailbox and encrypts the original login and password", async () => {
            vi.mocked(prisma.team.findUnique).mockResolvedValue({ aiConfig: { smtpConfig: legacy } } as never);
            vi.mocked(prisma.connectedMailbox.findFirst).mockResolvedValue(null);
            vi.mocked(prisma.connectedMailbox.findFirstOrThrow).mockResolvedValue({ id: "migrated", status: "CONNECTED", metadata: {} } as never);
            vi.mocked(prisma.connectedMailbox.createMany).mockResolvedValue({ count: 1 });
            const { ensureLegacySmtpMailbox } = await import("../smtpConfigService");

            await expect(ensureLegacySmtpMailbox("team")).resolves.toMatchObject({ id: "migrated", status: "CONNECTED" });
            expect(encryptCredential).toHaveBeenCalledWith("smtp-login");
            expect(encryptCredential).toHaveBeenCalledWith("fixture-value");
            expect(prisma.connectedMailbox.createMany).toHaveBeenCalledWith({
                data: [expect.objectContaining({
                    teamId: "team", email: "outreach@example.test", provider: "SMTP", dailyLimit: 50, minDelaySeconds: 180,
                    encryptedAccessToken: expect.objectContaining({ v: 1 }), encryptedRefreshToken: expect.objectContaining({ v: 1 }),
                    metadata: { legacyTeamSmtp: true, host: "smtp.example.test", port: 587, secure: false },
                })],
                skipDuplicates: true,
            });
            expect(prisma.auditLog.create).toHaveBeenCalledOnce();

            vi.mocked(prisma.connectedMailbox.findFirst).mockResolvedValue({ id: "migrated", status: "CONNECTED", metadata: {} } as never);
            await ensureLegacySmtpMailbox("team");
            expect(prisma.connectedMailbox.createMany).toHaveBeenCalledTimes(1);
        });

        it("disables and clears a linked mailbox when its legacy config is removed", async () => {
            vi.mocked(prisma.team.findUnique).mockResolvedValue({ aiConfig: { smtpConfig: legacy } } as never);
            vi.mocked(prisma.connectedMailbox.findMany).mockResolvedValue([{ id: "migrated", email: "outreach@example.test", metadata: { legacyTeamSmtp: true } }] as never);
            const { deleteSmtpConfig } = await import("../smtpConfigService");
            await deleteSmtpConfig("team");
            expect(prisma.connectedMailbox.update).toHaveBeenCalledWith({
                where: { id: "migrated" }, data: expect.objectContaining({ status: "DISCONNECTED" }),
            });
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
