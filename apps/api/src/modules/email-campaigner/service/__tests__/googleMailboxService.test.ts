import { vi, describe, it, expect, beforeEach, afterEach, afterAll, Mock } from "vitest";
import crypto from "crypto";
import {
    decryptMailboxSecret,
    buildGoogleMailboxAuthUrl,
    connectGoogleMailbox,
    handleGooglePubSubNotification,
} from "../googleMailboxService";
import { prisma } from "@/lib/db";

// Mock the prisma client
vi.mock("@/lib/db", () => ({
    prisma: {
        connectedMailbox: {
            upsert: vi.fn(),
            update: vi.fn(),
            findUnique: vi.fn(),
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        verificationToken: {
            create: vi.fn(),
            deleteMany: vi.fn(),
        },
        emailEvent: {
            findFirst: vi.fn(),
            create: vi.fn(),
        },
        mailboxSyncCursor: {
            upsert: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}));

// Mock global fetch
const originalFetch = global.fetch;
const mockFetch = vi.fn();
global.fetch = mockFetch;

function signState(payload: any, secret = "mock-nextauth-secret"): string {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
}

describe("GoogleMailboxService - Phase 2A/2A.1 Security", () => {
    const mockEncryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64 hex chars

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("ENCRYPTION_KEY", mockEncryptionKey);
        vi.stubEnv("GOOGLE_CLIENT_ID", "mock-client-id");
        vi.stubEnv("GOOGLE_CLIENT_SECRET", "mock-client-secret");
        vi.stubEnv("GOOGLE_GMAIL_REDIRECT_URI", "http://localhost:3000/oauth/callback");
        vi.stubEnv("NEXTAUTH_SECRET", "mock-nextauth-secret");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    function encryptHelper(value: string, keyHex: string): { v: number; cipher: string; iv: string; tag: string } {
        const key = Buffer.from(keyHex, "hex");
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
        const tag = cipher.getAuthTag();
        return {
            v: 1,
            cipher: encrypted.toString("base64"),
            iv: iv.toString("base64"),
            tag: tag.toString("base64"),
        };
    }

    describe("Encryption Key Validation", () => {
        it("should accept valid 64-character hexadecimal key", async () => {
            const payload = encryptHelper("secret-token", mockEncryptionKey);
            const decrypted = await decryptMailboxSecret(payload);
            expect(decrypted).toBe("secret-token");
        });

        it("should reject 63-character key", async () => {
            vi.stubEnv("ENCRYPTION_KEY", mockEncryptionKey.slice(0, 63));
            const payload = encryptHelper("secret-token", mockEncryptionKey);
            await expect(decryptMailboxSecret(payload)).rejects.toThrow("ENCRYPTION_KEY must be exactly 64 characters.");
        });

        it("should reject 65-character key", async () => {
            vi.stubEnv("ENCRYPTION_KEY", mockEncryptionKey + "a");
            const payload = encryptHelper("secret-token", mockEncryptionKey);
            await expect(decryptMailboxSecret(payload)).rejects.toThrow("ENCRYPTION_KEY must be exactly 64 characters.");
        });

        it("should reject non-hex key", async () => {
            vi.stubEnv("ENCRYPTION_KEY", mockEncryptionKey.replace(/[0-9]/g, "z"));
            const payload = encryptHelper("secret-token", mockEncryptionKey);
            await expect(decryptMailboxSecret(payload)).rejects.toThrow("ENCRYPTION_KEY must contain hexadecimal characters only.");
        });

        it("should reject when key is missing (undefined/string check)", async () => {
            const payload = encryptHelper("secret-token", mockEncryptionKey);
            vi.stubEnv("ENCRYPTION_KEY", undefined as any);
            await expect(decryptMailboxSecret(payload)).rejects.toThrow("ENCRYPTION_KEY must be a string.");
        });
    });

    describe("OAuth State Replay Protection", () => {
        it("should remain unresolved while VerificationToken.create is pending", async () => {
            let resolveCreate!: (value: unknown) => void;
            const createPromise = new Promise((resolve) => {
                resolveCreate = resolve;
            });
            (prisma.verificationToken.create as Mock).mockReturnValueOnce(createPromise);

            let settled = false;
            const authPromise = buildGoogleMailboxAuthUrl({ teamId: "t1", userId: "u1" }).then((value) => {
                settled = true;
                return value;
            });

            await Promise.resolve();
            expect(settled).toBe(false);

            resolveCreate({ identifier: "id" });
            await expect(authPromise).resolves.toContain("state=");
        });

        it("should store token equal to SHA-256 of signed nonce and not equal raw nonce", async () => {
            (prisma.verificationToken.create as Mock).mockResolvedValueOnce({ identifier: "id" });

            const authUrl = await buildGoogleMailboxAuthUrl({ teamId: "t1", userId: "u1" });
            const state = new URL(authUrl).searchParams.get("state") || "";
            const [body] = state.split(".");
            const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
            const nonce = payload.nonce;
            const expectedHash = crypto.createHash("sha256").update(nonce).digest("hex");

            expect(prisma.verificationToken.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        identifier: "gmail-oauth-state:t1:u1",
                        token: expectedHash,
                    }),
                })
            );

            const callData = (prisma.verificationToken.create as Mock).mock.calls[0][0].data;
            expect(callData.token).not.toBe(nonce);
            expect(callData.token).toMatch(/^[0-9a-fA-F]{64}$/);
        });

        it("should reject deleteMany if HMAC is invalid", async () => {
            const badSigState = "eyJ0ZWFtSWQiOiJ0MSIsInVzZXJJZCI6InUxIiwibm9uY2UiOiJub25jZSIsInRzIjoxMjM0NTZ9.bGFzaWduaW5n";
            await expect(connectGoogleMailbox({ code: "code", state: badSigState })).rejects.toThrow("Invalid OAuth state signature.");
            expect(prisma.verificationToken.deleteMany).not.toHaveBeenCalled();
        });

        it("should reject deleteMany if state is expired", async () => {
            const expiredState = signState({ teamId: "t1", userId: "u1", nonce: "nonce", ts: Date.now() - 15 * 60 * 1000 });
            await expect(connectGoogleMailbox({ code: "code", state: expiredState })).rejects.toThrow("OAuth state expired.");
            expect(prisma.verificationToken.deleteMany).not.toHaveBeenCalled();
        });

        it("should reject altered teamId even if signature is valid for that payload", async () => {
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 0 });

            // Generate state signed legitimately, but teamId was altered relative to original saved state
            const alteredState = signState({ teamId: "t2", userId: "u1", nonce: "nonce", ts: Date.now() });
            await expect(connectGoogleMailbox({ code: "code", state: alteredState })).rejects.toThrow(
                "Invalid state, expired state, or state already consumed."
            );
            expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        identifier: "gmail-oauth-state:t2:u1",
                    }),
                })
            );
        });

        it("should reject altered userId", async () => {
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 0 });

            const alteredState = signState({ teamId: "t1", userId: "u2", nonce: "nonce", ts: Date.now() });
            await expect(connectGoogleMailbox({ code: "code", state: alteredState })).rejects.toThrow(
                "Invalid state, expired state, or state already consumed."
            );
        });

        it("should throw and not call fetch for code exchange when replay count is zero", async () => {
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 0 });

            const validState = signState({ teamId: "t1", userId: "u1", nonce: "nonce", ts: Date.now() });
            await expect(connectGoogleMailbox({ code: "code", state: validState })).rejects.toThrow();
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it("should call deleteMany with identifier, token hash, and expires > now", async () => {
            const validState = signState({ teamId: "t1", userId: "u1", nonce: "my-nonce", ts: Date.now() });
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 1 });

            // Mock remaining calls to avoid crash
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: "access" }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ emailAddress: "test@gmail.com" }),
            });
            (prisma.connectedMailbox.findUnique as Mock).mockResolvedValueOnce(null);
            (prisma.connectedMailbox.upsert as Mock).mockResolvedValueOnce({ id: "m1" });

            await connectGoogleMailbox({ code: "code", state: validState });

            const expectedHash = crypto.createHash("sha256").update("my-nonce").digest("hex");
            expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        identifier: "gmail-oauth-state:t1:u1",
                        token: expectedHash,
                        expires: expect.objectContaining({
                            gt: expect.any(Date),
                        }),
                    }),
                })
            );
        });

        it("should return no URL when state creation fails", async () => {
            (prisma.verificationToken.create as Mock).mockRejectedValueOnce(new Error("DB error"));
            await expect(buildGoogleMailboxAuthUrl({ teamId: "t1", userId: "u1" })).rejects.toThrow("Failed to persist OAuth state.");
        });
    });

    describe("OAuth Reconnect & Refresh Token Preservation", () => {
        const createParams = (state: string) => ({
            code: "code",
            state,
        });

        it("should encrypt and store a new refresh token", async () => {
            const state = signState({ teamId: "t1", userId: "u1", nonce: "nonce", ts: Date.now() });
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 1 });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: "acc", refresh_token: "new-refresh", expires_in: 3600 }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ emailAddress: "test@gmail.com" }),
            });
            (prisma.connectedMailbox.findUnique as Mock).mockResolvedValueOnce(null);
            (prisma.connectedMailbox.upsert as Mock).mockResolvedValueOnce({ id: "m1" });

            await connectGoogleMailbox(createParams(state));

            const upsertArgs = (prisma.connectedMailbox.upsert as Mock).mock.calls[0][0];
            expect(upsertArgs.create.status).toBe("CONNECTED");
            expect(upsertArgs.create.encryptedRefreshToken).toBeDefined();
        });

        it("should replace existing refresh token when new one is returned", async () => {
            const state = signState({ teamId: "t1", userId: "u1", nonce: "nonce", ts: Date.now() });
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 1 });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: "acc", refresh_token: "brand-new-refresh", expires_in: 3600 }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ emailAddress: "test@gmail.com" }),
            });

            const oldRefresh = { v: 1, cipher: "old", iv: "iv", tag: "tag" };
            (prisma.connectedMailbox.findUnique as Mock).mockResolvedValueOnce({
                id: "m1",
                email: "test@gmail.com",
                encryptedRefreshToken: oldRefresh,
            });
            (prisma.connectedMailbox.upsert as Mock).mockResolvedValueOnce({ id: "m1" });

            await connectGoogleMailbox(createParams(state));

            const upsertArgs = (prisma.connectedMailbox.upsert as Mock).mock.calls[0][0];
            expect(upsertArgs.create.encryptedRefreshToken).not.toEqual(oldRefresh);
        });

        it("should preserve existing refresh token if Google omits it", async () => {
            const state = signState({ teamId: "t1", userId: "u1", nonce: "nonce", ts: Date.now() });
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 1 });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: "acc", expires_in: 3600 }), // no refresh token!
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ emailAddress: "test@gmail.com" }),
            });

            const existingRefresh = { v: 1, cipher: "keep-me", iv: "iv", tag: "tag" };
            (prisma.connectedMailbox.findUnique as Mock).mockResolvedValueOnce({
                id: "m1",
                email: "test@gmail.com",
                encryptedRefreshToken: existingRefresh,
            });
            (prisma.connectedMailbox.upsert as Mock).mockResolvedValueOnce({ id: "m1" });

            await connectGoogleMailbox(createParams(state));

            const upsertArgs = (prisma.connectedMailbox.upsert as Mock).mock.calls[0][0];
            expect(upsertArgs.create.status).toBe("CONNECTED");
            expect(upsertArgs.create.encryptedRefreshToken).toEqual(existingRefresh);
            expect(upsertArgs.update.encryptedRefreshToken).toEqual(existingRefresh);
        });

        it("should set status to NEEDS_RECONNECT when both new and existing refresh tokens are absent", async () => {
            const state = signState({ teamId: "t1", userId: "u1", nonce: "nonce", ts: Date.now() });
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 1 });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: "acc" }), // no refresh token
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ emailAddress: "test@gmail.com" }),
            });
            (prisma.connectedMailbox.findUnique as Mock).mockResolvedValueOnce(null); // no existing mailbox
            (prisma.connectedMailbox.upsert as Mock).mockResolvedValueOnce({ id: "m1" });

            await connectGoogleMailbox(createParams(state));

            const upsertArgs = (prisma.connectedMailbox.upsert as Mock).mock.calls[0][0];
            expect(upsertArgs.create.status).toBe("NEEDS_RECONNECT");
            expect(upsertArgs.create.encryptedRefreshToken).toBeUndefined();
            expect(upsertArgs.update.status).toBe("NEEDS_RECONNECT");
            expect(upsertArgs.update.encryptedRefreshToken).toBeUndefined();
        });
    });

    describe("Tenant-Safety for Pub/Sub Notifications", () => {
        function createPayloadBase64(payload: any) {
            return Buffer.from(JSON.stringify(payload)).toString("base64url");
        }

        it("should return UNKNOWN_MAILBOX when zero matching Google mailboxes exist", async () => {
            (prisma.connectedMailbox.findMany as Mock).mockResolvedValueOnce([]);

            const data = createPayloadBase64({ emailAddress: "unregistered@gmail.com", historyId: "123" });
            const result = await handleGooglePubSubNotification({ data });

            expect(result).toEqual({ accepted: false, reason: "UNKNOWN_MAILBOX" });
            expect(prisma.connectedMailbox.findMany).toHaveBeenCalled();
        });

        it("should process sync when exactly one matching Google mailbox is found", async () => {
            const encryptedAccessToken = encryptHelper("my-access-token", mockEncryptionKey);
            const mailbox = {
                id: "m1",
                teamId: "t1",
                email: "test@gmail.com",
                status: "CONNECTED",
                encryptedAccessToken,
                tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
                historyId: "100",
            };
            (prisma.connectedMailbox.findMany as Mock).mockResolvedValueOnce([mailbox]);
            (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce(mailbox);
            (prisma.mailboxSyncCursor.upsert as Mock).mockResolvedValueOnce({ mailboxId: "m1", historyId: "100" });
            (prisma.mailboxSyncCursor.updateMany as Mock).mockResolvedValueOnce({ count: 1 });

            // Mock fetch call for history listing
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ historyId: "125", history: [] }),
            });
            (prisma.connectedMailbox.update as Mock).mockResolvedValueOnce(mailbox);

            const data = createPayloadBase64({ emailAddress: "test@gmail.com", historyId: "123" });
            const result = await handleGooglePubSubNotification({ data, messageId: "msg-1" });

            expect(result.accepted).toBe(true);
            expect(result.mailboxId).toBe("m1");
            expect(result.teamId).toBe("t1");
            expect(prisma.emailEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        teamId: "t1",
                        mailboxId: "m1",
                    }),
                })
            );
        });

        it("should return AMBIGUOUS_MAILBOX and perform no sync or EmailEvent insertion when two matching mailboxes exist", async () => {
            const mailbox1 = { id: "m1", teamId: "t1", email: "shared@gmail.com" };
            const mailbox2 = { id: "m2", teamId: "t2", email: "shared@gmail.com" };
            (prisma.connectedMailbox.findMany as Mock).mockResolvedValueOnce([mailbox1, mailbox2]);

            const data = createPayloadBase64({ emailAddress: "shared@gmail.com", historyId: "123" });
            const result = await handleGooglePubSubNotification({ data, messageId: "msg-1" });

            expect(result).toEqual({ accepted: false, reason: "AMBIGUOUS_MAILBOX" });
            expect(prisma.emailEvent.create).not.toHaveBeenCalled();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });
});
