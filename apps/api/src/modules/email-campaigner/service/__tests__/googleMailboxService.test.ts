import { vi, describe, it, expect, beforeEach, afterEach, afterAll, Mock } from "vitest";
import crypto from "crypto";
import {
    decryptMailboxSecret,
    buildGoogleMailboxAuthUrl,
    connectGoogleMailbox,
    handleGooglePubSubNotification,
    acquireGmailMailboxLease,
    renewGmailMailboxLease,
    assertGmailMailboxLeaseOwned,
    commitGmailMailboxCursorAndRelease,
    releaseGmailMailboxLeaseAfterFailure,
    syncGoogleMailbox,
    syncDueGoogleMailboxes,
    sendViaGmailMailbox,
    registerGoogleMailboxWatch,
    renewDueGoogleMailboxWatches,
    advanceMailboxWarmup,
    resolveGoogleMailbox,
    assertGmailMailboxLeaseInTransaction,
    GmailMailboxLeaseContendedError,
    GmailMailboxLeaseLostError,
    GmailRecoveryLimitExceededError,
    GmailRecoveryUnresolvableRecordError,
    LegacyGmailEventAmbiguousError,
    type GmailMailboxLease,
} from "../googleMailboxService";
import { prisma } from "@/lib/db";

const { mockDb } = vi.hoisted(() => {
    const db: any = {
        connectedMailbox: {
            upsert: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
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
            update: vi.fn(),
        },
        mailboxSyncCursor: {
            upsert: vi.fn(),
            updateMany: vi.fn(),
            findUnique: vi.fn(),
        },
        email: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        message: { create: vi.fn() },
        lead: { findUnique: vi.fn(), findFirst: vi.fn().mockResolvedValue({ id: "lead-1", status: "NEW", pipelineState: "COLD" }), update: vi.fn() },
        suppressionEntry: { upsert: vi.fn() },
    };
    db.$queryRaw = vi.fn().mockResolvedValue([{ id: "cursor-1" }]);
    db.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(db));
    return { mockDb: db };
});

vi.mock("@/lib/db", () => ({ prisma: mockDb }));

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
        (mockDb.$transaction as Mock).mockImplementation(async (callback: (tx: any) => unknown) => callback(mockDb));
        (prisma.mailboxSyncCursor.updateMany as Mock).mockResolvedValue({ count: 1 });
        (prisma.mailboxSyncCursor.findUnique as Mock).mockImplementation(async () => {
            const acquisition = [...(prisma.mailboxSyncCursor.updateMany as Mock).mock.calls]
                .reverse()
                .find((call) => call[0]?.data?.status === "RUNNING" && call[0]?.data?.lockToken);
            return { historyId: "100", lockToken: acquisition?.[0].data.lockToken };
        });
        (prisma.connectedMailbox.updateMany as Mock).mockResolvedValue({ count: 1 });
        (prisma.email.findMany as Mock).mockResolvedValue([]);
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

        it("should store a purpose-separated HMAC digest of the nonce and not the raw nonce", async () => {
            (prisma.verificationToken.create as Mock).mockResolvedValueOnce({ identifier: "id" });

            const authUrl = await buildGoogleMailboxAuthUrl({ teamId: "t1", userId: "u1" });
            const state = new URL(authUrl).searchParams.get("state") || "";
            const [body] = state.split(".");
            const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
            const nonce = payload.nonce;
            const expectedHash = crypto
                .createHmac("sha256", "mock-nextauth-secret")
                .update(`gmail-oauth-state-nonce:v1:${nonce}`)
                .digest("hex");

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
            (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce(null);
            (prisma.connectedMailbox.upsert as Mock).mockResolvedValueOnce({ id: "m1" });

            await connectGoogleMailbox({ code: "code", state: validState });

            const expectedHash = crypto
                .createHmac("sha256", "mock-nextauth-secret")
                .update("gmail-oauth-state-nonce:v1:my-nonce")
                .digest("hex");
            expect(expectedHash).not.toBe("my-nonce");
            expect(expectedHash).toMatch(/^[0-9a-f]{64}$/);
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
            (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce(null);
            (prisma.connectedMailbox.upsert as Mock).mockResolvedValueOnce({ id: "m1" });

            await connectGoogleMailbox(createParams(state));

            const upsertArgs = (prisma.connectedMailbox.upsert as Mock).mock.calls[0][0];
            expect(upsertArgs.create.status).toBe("CONNECTED");
            expect(upsertArgs.create.encryptedRefreshToken).toBeDefined();
        });

        it("should replace an existing refresh token through the reconnection update branch", async () => {
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
            (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce({
                id: "m1",
                teamId: "t1",
                email: "test@gmail.com",
                encryptedRefreshToken: oldRefresh,
                metadata: { watchStatus: "ACTIVE", watchExpiresAt: "2030-01-01T00:00:00.000Z", syncEvidence: "kept" },
            });
            (prisma.connectedMailbox.upsert as Mock).mockResolvedValueOnce({ id: "m1" });

            await connectGoogleMailbox(createParams(state));

            const upsertArgs = (prisma.connectedMailbox.upsert as Mock).mock.calls[0][0];
            expect(upsertArgs.update.encryptedRefreshToken).not.toEqual(oldRefresh);
            expect(upsertArgs.update.metadata).toEqual(expect.objectContaining({
                watchStatus: "ACTIVE",
                watchExpiresAt: "2030-01-01T00:00:00.000Z",
                syncEvidence: "kept",
                reconnectedBy: "u1",
            }));
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
            (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce({
                id: "m1",
                teamId: "t1",
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
            (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce(null); // no existing mailbox
            (prisma.connectedMailbox.upsert as Mock).mockResolvedValueOnce({ id: "m1" });

            await connectGoogleMailbox(createParams(state));

            const upsertArgs = (prisma.connectedMailbox.upsert as Mock).mock.calls[0][0];
            expect(upsertArgs.create.status).toBe("NEEDS_RECONNECT");
            expect(upsertArgs.create.encryptedRefreshToken).toBeUndefined();
            expect(upsertArgs.update.status).toBe("NEEDS_RECONNECT");
            expect(upsertArgs.update.encryptedRefreshToken).toBeUndefined();
        });

        it("allows a first normalized mailbox connection", async () => {
            const state = signState({ teamId: "t1", userId: "u1", nonce: "nonce", ts: Date.now() });
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 1 });
            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "acc", refresh_token: "refresh" }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ emailAddress: "Owner@Example.com" }) });
            (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce(null);
            (prisma.connectedMailbox.upsert as Mock).mockResolvedValueOnce({ id: "m1" });

            await expect(connectGoogleMailbox(createParams(state))).resolves.toEqual(expect.objectContaining({ mailbox: { id: "m1" } }));

            expect(prisma.connectedMailbox.upsert).toHaveBeenCalledWith(expect.objectContaining({
                create: expect.objectContaining({ email: "owner@example.com" }),
            }));
        });

        it("returns the controlled ownership conflict for a concurrent global-email unique constraint", async () => {
            const state = signState({ teamId: "t1", userId: "u1", nonce: "nonce", ts: Date.now() });
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 1 });
            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "acc", refresh_token: "refresh" }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ emailAddress: "owner@example.com" }) });
            (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce(null);
            (prisma.connectedMailbox.upsert as Mock).mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "P2002" }));

            await expect(connectGoogleMailbox(createParams(state)))
                .rejects.toThrow("This mailbox is already connected to another team.");
        });

        it("propagates a non-unique mailbox persistence failure", async () => {
            const state = signState({ teamId: "t1", userId: "u1", nonce: "nonce", ts: Date.now() });
            const persistenceError = new Error("database unavailable");
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 1 });
            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "acc", refresh_token: "refresh" }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ emailAddress: "owner@example.com" }) });
            (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce(null);
            (prisma.connectedMailbox.upsert as Mock).mockRejectedValueOnce(persistenceError);

            await expect(connectGoogleMailbox(createParams(state))).rejects.toBe(persistenceError);
        });

        it("rejects a mailbox already owned by another team", async () => {
            const state = signState({ teamId: "t1", userId: "u1", nonce: "nonce", ts: Date.now() });
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 1 });
            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "acc", refresh_token: "refresh" }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ emailAddress: "owner@example.com" }) });
            (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce({ id: "m-other", teamId: "other-team", email: "owner@example.com" });

            await expect(connectGoogleMailbox(createParams(state))).rejects.toThrow("This mailbox is already connected to another team.");
            expect(prisma.connectedMailbox.upsert).not.toHaveBeenCalled();
        });

        it("rejects a normalized-case duplicate owned by another team", async () => {
            const state = signState({ teamId: "t1", userId: "u1", nonce: "nonce", ts: Date.now() });
            (prisma.verificationToken.deleteMany as Mock).mockResolvedValueOnce({ count: 1 });
            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "acc", refresh_token: "refresh" }) })
                .mockResolvedValueOnce({ ok: true, json: async () => ({ emailAddress: "Owner@Example.com" }) });
            (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce({ id: "m-other", teamId: "other-team", email: "owner@example.com" });

            await expect(connectGoogleMailbox(createParams(state))).rejects.toThrow("This mailbox is already connected to another team.");
            expect(prisma.connectedMailbox.findFirst).toHaveBeenCalledWith({ where: { email: "owner@example.com" } });
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
                provider: "GOOGLE_WORKSPACE",
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

describe("GoogleMailboxService - bounded OAuth code exchange", () => {
    const encryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    function oauthState() {
        return signState({ teamId: "team-1", userId: "user-1", nonce: "nonce", ts: Date.now() });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = mockFetch;
        mockFetch.mockReset();
        vi.stubEnv("ENCRYPTION_KEY", encryptionKey);
        vi.stubEnv("NEXTAUTH_SECRET", "mock-nextauth-secret");
        vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
        vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
        vi.stubEnv("GOOGLE_GMAIL_REDIRECT_URI", "https://example.test/oauth/callback");
        vi.stubEnv("NEXTAUTH_SECRET", "mock-nextauth-secret");
        vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
        vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
        vi.stubEnv("GOOGLE_GMAIL_REDIRECT_URI", "https://example.test/oauth/callback");
        (prisma.verificationToken.deleteMany as Mock).mockResolvedValue({ count: 1 });
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(null);
        (prisma.connectedMailbox.upsert as Mock).mockResolvedValue({ id: "mailbox-1" });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    it("uses the bounded helper for a successful OAuth code exchange and preserves parsed tokens", async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: "test-access-token", refresh_token: "test-refresh-token", expires_in: 3600 }) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ emailAddress: "owner@example.com" }) });

        await expect(connectGoogleMailbox({ code: "test-authorisation-code", state: oauthState() })).resolves.toEqual(expect.objectContaining({
            mailbox: expect.objectContaining({ id: "mailbox-1" }),
        }));

        expect(mockFetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
        expect((prisma.connectedMailbox.upsert as Mock).mock.calls[0][0].create.encryptedAccessToken).toBeDefined();
    });

    it("maps OAuth HTTP failure to a safe code without provider text or the authorization code", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({ error_description: "provider body must never escape" }),
        });

        await expect(connectGoogleMailbox({ code: "authorization-code-secret", state: oauthState() }))
            .rejects.toThrow("GOOGLE_OAUTH_CODE_EXCHANGE_FAILED");
    });

    it("maps malformed OAuth JSON to a safe response-invalid code", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => { throw new Error("provider response body must never escape"); },
        });

        await expect(connectGoogleMailbox({ code: "authorization-code-secret", state: oauthState() }))
            .rejects.toThrow("GOOGLE_OAUTH_TOKEN_RESPONSE_INVALID");
    });

    it("aborts a hung OAuth exchange and exposes only the stable timeout code", async () => {
        vi.useFakeTimers();
        mockFetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("provider timeout body authorization-code-secret")), { once: true });
        }));

        const exchange = connectGoogleMailbox({ code: "authorization-code-secret", state: oauthState() });
        const exchangeError = exchange.catch((error) => error);
        await vi.advanceTimersByTimeAsync(60_000);

        await expect(exchangeError).resolves.toMatchObject({ message: "GOOGLE_OAUTH_CODE_EXCHANGE_TIMEOUT" });
    });
});

describe("GoogleMailboxService - Phase 2C leases, recovery, and transactions", () => {
    const encryptionKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    function encryptedToken(value = "access-token") {
        const key = Buffer.from(encryptionKey, "hex");
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
        return { v: 1, cipher: encrypted.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
    }

    function mailbox(historyId: string | null = "100") {
        return {
            id: "mailbox-1",
            teamId: "team-1",
            provider: "GOOGLE_WORKSPACE",
            email: "owner@example.com",
            historyId,
            metadata: null,
            encryptedAccessToken: encryptedToken(),
            tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        };
    }

    function mailboxNeedingRefresh() {
        return {
            ...mailbox(),
            encryptedRefreshToken: encryptedToken("refresh-token"),
            tokenExpiresAt: new Date(Date.now() - 60_000),
        };
    }

    function lease(startingHistoryId: string | null = "100", token = "lease-token"): GmailMailboxLease {
        return {
            mailboxId: "mailbox-1",
            cursorType: "GMAIL_HISTORY",
            token,
            acquiredAt: new Date(Date.now() - 1_000),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            startingHistoryId,
        };
    }

    function response(data: any, ok = true, status = 200) {
        return { ok, status, json: async () => data };
    }

    function replyMessage(id = "inbound-1") {
        return {
            id,
            threadId: "thread-1",
            payload: {
                headers: [
                    { name: "From", value: "Lead <lead@example.com>" },
                    { name: "Subject", value: "Re: Hello" },
                    { name: "In-Reply-To", value: "gmail-outbound-1" },
                ],
            },
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = mockFetch;
        mockFetch.mockReset();
        vi.stubEnv("ENCRYPTION_KEY", encryptionKey);
        vi.stubEnv("NEXTAUTH_SECRET", "mock-nextauth-secret");
        vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
        vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
        vi.stubEnv("GOOGLE_GMAIL_REDIRECT_URI", "https://example.test/oauth/callback");
        (mockDb.$transaction as Mock).mockImplementation(async (callback: (tx: any) => unknown) => callback(mockDb));
        (prisma.mailboxSyncCursor.upsert as Mock).mockResolvedValue({});
        (prisma.mailboxSyncCursor.updateMany as Mock).mockResolvedValue({ count: 1 });
        (prisma.mailboxSyncCursor.findUnique as Mock).mockImplementation(async () => {
            const acquisition = [...(prisma.mailboxSyncCursor.updateMany as Mock).mock.calls]
                .reverse()
                .find((call) => call[0]?.data?.status === "RUNNING" && call[0]?.data?.lockToken);
            return { historyId: "100", lockToken: acquisition?.[0].data.lockToken };
        });
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailbox());
        (prisma.connectedMailbox.updateMany as Mock).mockResolvedValue({ count: 1 });
        (prisma.email.findMany as Mock).mockResolvedValue([]);
        (prisma.email.findFirst as Mock).mockResolvedValue({ id: "email-1", leadId: "lead-1", campaignId: "campaign-1" });
        (prisma.emailEvent.findFirst as Mock).mockResolvedValue(null);
        (prisma.emailEvent.create as Mock).mockResolvedValue({ id: "event-1" });
        (prisma.emailEvent.update as Mock).mockResolvedValue({ id: "event-1", processedAt: new Date() });
        (prisma.message.create as Mock).mockResolvedValue({ id: "message-1" });
        (prisma.email.update as Mock).mockResolvedValue({ id: "email-1" });
        (prisma.lead.findUnique as Mock).mockResolvedValue({ email: "lead@example.com" });
        (prisma.lead.update as Mock).mockResolvedValue({ id: "lead-1" });
        (prisma.connectedMailbox.update as Mock).mockResolvedValue({ id: "mailbox-1" });
        (prisma.suppressionEntry.upsert as Mock).mockResolvedValue({ id: "suppression-1" });
        (mockDb.$queryRaw as Mock).mockResolvedValue([{ id: "cursor-1" }]);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it("marks NEEDS_RECONNECT only for an explicit invalid_grant refresh rejection", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailboxNeedingRefresh());
        mockFetch.mockResolvedValueOnce(response({ error: "invalid_grant" }, false, 400));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .rejects.toThrow("GOOGLE_TOKEN_REFRESH_CREDENTIAL_REJECTED");

        expect(prisma.connectedMailbox.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "mailbox-1" },
            data: expect.objectContaining({ status: "NEEDS_RECONNECT" }),
        }));
    });

    it("preserves mailbox status for a refresh timeout", async () => {
        vi.useFakeTimers();
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailboxNeedingRefresh());
        mockFetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("provider timeout detail")), { once: true });
        }));

        const syncError = syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }).catch((error) => error);
        await vi.advanceTimersByTimeAsync(60_000);

        await expect(syncError).resolves.toMatchObject({ name: "GmailRequestTimeoutError" });
        expect((prisma.connectedMailbox.update as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "NEEDS_RECONNECT",
        )).toBe(false);
    });

    it("preserves mailbox status for an HTTP 500 refresh failure", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailboxNeedingRefresh());
        mockFetch.mockResolvedValueOnce(response({ error: "server_error" }, false, 500));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() })).rejects.toThrow("HTTP 500");
        expect((prisma.connectedMailbox.update as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "NEEDS_RECONNECT",
        )).toBe(false);
    });

    it("preserves mailbox status for a malformed successful refresh response", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailboxNeedingRefresh());
        mockFetch.mockResolvedValueOnce(response({}));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() })).rejects.toThrow("Google response was invalid during token refresh.");
        expect((prisma.connectedMailbox.update as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "NEEDS_RECONNECT",
        )).toBe(false);
    });

    it("treats invalid_grant in a malformed successful refresh response as a credential rejection", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailboxNeedingRefresh());
        mockFetch.mockResolvedValueOnce(response({ error: "invalid_grant" }));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .rejects.toThrow("GOOGLE_TOKEN_REFRESH_CREDENTIAL_REJECTED");
        expect(prisma.connectedMailbox.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "mailbox-1" },
            data: expect.objectContaining({ status: "NEEDS_RECONNECT" }),
        }));
    });

    it("uses a null expiry when Google omits expires_in during a successful refresh", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailboxNeedingRefresh());
        mockFetch
            .mockResolvedValueOnce(response({ access_token: "fresh-access-token" }))
            .mockResolvedValueOnce(response({ historyId: "101", history: [] }));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .resolves.toMatchObject({ synced: 0, replies: 0, bounces: 0 });
        expect(prisma.connectedMailbox.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "mailbox-1" },
            data: expect.objectContaining({ tokenExpiresAt: null }),
        }));
    });

    it("persists a refreshed access token before continuing Gmail history sync", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailboxNeedingRefresh());
        mockFetch
            .mockResolvedValueOnce(response({ access_token: "fresh-access-token", expires_in: 3600 }))
            .mockResolvedValueOnce(response({ historyId: "101", history: [] }));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .resolves.toMatchObject({ synced: 0, replies: 0, bounces: 0 });

        expect(prisma.connectedMailbox.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "mailbox-1" },
            data: expect.objectContaining({
                encryptedAccessToken: expect.objectContaining({ v: 1 }),
                tokenExpiresAt: expect.any(Date),
            }),
        }));
    });

    it("does not overwrite a refresh-written NEEDS_RECONNECT status during scheduled sync", async () => {
        const refreshMailbox = mailboxNeedingRefresh();
        (prisma.connectedMailbox.findMany as Mock).mockResolvedValueOnce([{ id: "mailbox-1", teamId: "team-1", metadata: { retained: true } }]);
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(refreshMailbox);
        mockFetch.mockResolvedValueOnce(response({ error: "invalid_grant" }, false, 400));

        const results = await syncDueGoogleMailboxes(1);

        expect(results[0]?.error).toBe("GOOGLE_TOKEN_REFRESH_CREDENTIAL_REJECTED");
        expect((prisma.connectedMailbox.update as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "CONNECTED",
        )).toBe(false);
        expect((prisma.connectedMailbox.update as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "NEEDS_RECONNECT",
        )).toBe(true);
    });

    it("acquires independent UUID leases atomically and exposes the expired-or-unowned predicate", async () => {
        const first = await acquireGmailMailboxLease(mailbox());
        const secondMailbox = { ...mailbox(), id: "mailbox-2" };
        const second = await acquireGmailMailboxLease(secondMailbox);

        expect(first.token).toMatch(/^[0-9a-f-]{36}$/i);
        expect(second.token).not.toBe(first.token);
        expect(prisma.mailboxSyncCursor.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: {
                mailboxId: "mailbox-1",
                cursorType: "GMAIL_HISTORY",
                OR: [
                    { lockToken: null },
                    {
                        lockToken: { not: null },
                        lockExpiresAt: { not: null, lte: expect.any(Date) },
                    },
                ],
            },
            data: expect.objectContaining({ status: "RUNNING", lockToken: first.token }),
        }));
        expect((prisma.mailboxSyncCursor.upsert as Mock).mock.calls[0][0].update).toEqual({});
    });

    it("reports active same-mailbox ownership as contention and never steals it", async () => {
        (prisma.mailboxSyncCursor.updateMany as Mock).mockResolvedValueOnce({ count: 0 });
        await expect(acquireGmailMailboxLease(mailbox())).rejects.toBeInstanceOf(GmailMailboxLeaseContendedError);
        expect(prisma.mailboxSyncCursor.findUnique).not.toHaveBeenCalled();
    });

    it("does not treat an active token with a null expiry as available", async () => {
        (prisma.mailboxSyncCursor.updateMany as Mock).mockResolvedValueOnce({ count: 0 });

        await expect(acquireGmailMailboxLease(mailbox())).rejects.toBeInstanceOf(GmailMailboxLeaseContendedError);
        const predicate = (prisma.mailboxSyncCursor.updateMany as Mock).mock.calls[0][0].where.OR;
        expect(predicate).not.toContainEqual({ lockExpiresAt: null });
    });

    it("renews and asserts only an unexpired RUNNING lease with the exact token", async () => {
        const owned = lease();
        await renewGmailMailboxLease(owned);
        await assertGmailMailboxLeaseOwned(owned);

        for (const call of (prisma.mailboxSyncCursor.updateMany as Mock).mock.calls) {
            expect(call[0].where).toEqual(expect.objectContaining({
                mailboxId: owned.mailboxId,
                cursorType: "GMAIL_HISTORY",
                lockToken: owned.token,
                status: "RUNNING",
                lockExpiresAt: { gt: expect.any(Date) },
            }));
        }
        (prisma.mailboxSyncCursor.updateMany as Mock).mockResolvedValueOnce({ count: 0 });
        await expect(renewGmailMailboxLease({ ...owned, token: "stale-token" })).rejects.toBeInstanceOf(GmailMailboxLeaseLostError);
    });

    it("failure release clears only the exact owned token and a stale token cannot clear a newer lease", async () => {
        const owned = lease();
        await releaseGmailMailboxLeaseAfterFailure(owned, new Error("raw provider detail"));
        expect(prisma.mailboxSyncCursor.updateMany).toHaveBeenCalledWith({
            where: expect.objectContaining({ lockToken: owned.token, status: "RUNNING" }),
            data: expect.objectContaining({
                status: "ERROR",
                lastError: "GMAIL_SYNC_FAILED",
                lockToken: null,
                lockedAt: null,
                lockExpiresAt: null,
            }),
        });

        (prisma.mailboxSyncCursor.updateMany as Mock).mockResolvedValueOnce({ count: 0 });
        await expect(releaseGmailMailboxLeaseAfterFailure({ ...owned, token: "stale-token" }, new Error("x")))
            .rejects.toBeInstanceOf(GmailMailboxLeaseLostError);
    });

    it("commits equality and very large decimal cursors atomically with lease release", async () => {
        await commitGmailMailboxCursorAndRelease(mailbox(), lease("100"), "100");
        await commitGmailMailboxCursorAndRelease(mailbox(), lease("100"), "999999999999999999999999999999999999");

        expect(mockDb.$transaction).toHaveBeenCalledTimes(2);
        const commitCalls = (prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.filter(
            (call) => call[0]?.data?.status === "IDLE",
        );
        expect(commitCalls).toHaveLength(2);
        expect(commitCalls[0][0].where).toEqual(expect.objectContaining({
            lockToken: "lease-token",
            status: "RUNNING",
            historyId: "100",
        }));
        expect(commitCalls[0][0].data).toEqual(expect.objectContaining({
            historyId: "100",
            lockToken: null,
            lockedAt: null,
            lockExpiresAt: null,
        }));
    });

    it.each(["99", "", "12x", "-1"])("rejects regressing or invalid final history ID %j without mutation", async (finalHistoryId) => {
        await expect(commitGmailMailboxCursorAndRelease(mailbox(), lease("100"), finalHistoryId)).rejects.toThrow();
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("prevents a stale worker from committing after ownership or expected cursor state changes", async () => {
        (prisma.mailboxSyncCursor.updateMany as Mock).mockResolvedValueOnce({ count: 0 });
        await expect(commitGmailMailboxCursorAndRelease(mailbox(), lease("100", "stale-token"), "101"))
            .rejects.toBeInstanceOf(GmailMailboxLeaseLostError);
        expect(prisma.connectedMailbox.updateMany).not.toHaveBeenCalled();
    });

    it("awaits heartbeats before every history page and immediately before final commit", async () => {
        const setIntervalSpy = vi.spyOn(global, "setInterval");
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [], nextPageToken: "next" }))
            .mockResolvedValueOnce(response({ historyId: "151", history: [] }));

        await syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(String(mockFetch.mock.calls[1][0])).toContain("pageToken=next");
        const renewals = (prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.filter(
            (call) => call[0]?.data?.lockExpiresAt instanceof Date,
        );
        expect(renewals.length).toBeGreaterThanOrEqual(3);
        const commitIndex = (prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.findIndex(
            (call) => call[0]?.data?.status === "IDLE",
        );
        expect(commitIndex).toBeGreaterThan(renewals.length - 1);
        expect(setIntervalSpy).not.toHaveBeenCalled();
    });

    it("stops before Gmail processing when an awaited heartbeat loses ownership", async () => {
        (prisma.mailboxSyncCursor.updateMany as Mock)
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 0 });

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .rejects.toBeInstanceOf(GmailMailboxLeaseLostError);
        expect(mockFetch).not.toHaveBeenCalled();
        expect((prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.some(
            (call) => call[0]?.data?.lockToken === null,
        )).toBe(false);
    });

    it("recovers a 404 through every deterministic database page, deduplicates threads, and commits profile history only after success", async () => {
        const createdAt = new Date("2026-01-01T00:00:00.000Z");
        const firstPage = Array.from({ length: 250 }, (_, index) => ({
            id: `email-${String(index).padStart(3, "0")}`,
            createdAt,
            threadId: "thread-1",
            providerId: `provider-${index}`,
        }));
        (prisma.email.findMany as Mock)
            .mockResolvedValueOnce(firstPage)
            .mockResolvedValueOnce([{ id: "email-999", createdAt: new Date("2026-01-02"), threadId: "thread-2", providerId: "provider-999" }]);
        mockFetch.mockImplementation(async (url: string) => {
            if (url.includes("/history")) return response({ error: { message: "history expired" } }, false, 404);
            if (url.includes("/threads/")) return response({ messages: [] });
            if (url.includes("/profile")) return response({ historyId: "200" });
            throw new Error(`unexpected URL ${url}`);
        });

        await syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() });

        expect(prisma.email.findMany).toHaveBeenCalledTimes(2);
        expect(prisma.email.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 250,
        }));
        const threadCalls = mockFetch.mock.calls.filter((call) => String(call[0]).includes("/threads/"));
        expect(threadCalls).toHaveLength(2);
        const recoveryRenewals = (prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.filter(
            (call) => call[0]?.data?.lockExpiresAt instanceof Date,
        );
        expect(recoveryRenewals.length).toBeGreaterThanOrEqual(5);
        expect((prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.some(
            (call) => call[0]?.data?.historyId === "200" && call[0]?.data?.status === "IDLE",
        )).toBe(true);
    });

    it("handles null thread IDs by resolving the conclusive Gmail provider message ID", async () => {
        (prisma.email.findMany as Mock).mockResolvedValueOnce([{
            id: "email-null-thread",
            createdAt: new Date("2026-01-01"),
            threadId: null,
            providerId: "gmail-outbound-1",
        }]);
        mockFetch.mockImplementation(async (url: string) => {
            if (url.includes("/history")) return response({}, false, 404);
            if (url.includes("/messages/gmail-outbound-1")) return response({ id: "gmail-outbound-1", threadId: "thread-1" });
            if (url.includes("/threads/thread-1")) return response({ messages: [] });
            if (url.includes("/profile")) return response({ historyId: "201" });
            throw new Error(`unexpected URL ${url}`);
        });

        await syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() });
        expect(mockFetch.mock.calls.some((call) => String(call[0]).includes("/messages/gmail-outbound-1"))).toBe(true);
        expect(mockFetch.mock.calls.some((call) => String(call[0]).includes("/threads/thread-1"))).toBe(true);
    });

    it("recovers only Gmail API deliveries and never sends SMTP or legacy provider IDs to Gmail", async () => {
        const records = [
            { id: "gmail-thread", createdAt: new Date("2026-01-01"), mailboxId: "mailbox-1", teamId: "team-1", deliveryProvider: "GMAIL_API", threadId: "gmail-thread-1", providerId: "gmail-message-1" },
            { id: "gmail-message", createdAt: new Date("2026-01-02"), mailboxId: "mailbox-1", teamId: "team-1", deliveryProvider: "GMAIL_API", threadId: null, providerId: "gmail-message-2" },
            { id: "smtp-record", createdAt: new Date("2026-01-03"), mailboxId: "mailbox-1", teamId: "team-1", deliveryProvider: "SMTP", threadId: null, providerId: "smtp-message-id" },
            { id: "legacy-record", createdAt: new Date("2026-01-04"), mailboxId: "mailbox-1", teamId: "team-1", deliveryProvider: null, threadId: null, providerId: "legacy-message-id" },
            { id: "other-team", createdAt: new Date("2026-01-05"), mailboxId: "mailbox-1", teamId: "team-2", deliveryProvider: "GMAIL_API", threadId: null, providerId: "other-team-message-id" },
        ];
        (prisma.email.findMany as Mock).mockImplementation(async (args) => {
            expect(args.where).toEqual(expect.objectContaining({
                mailboxId: "mailbox-1",
                deliveryProvider: "GMAIL_API",
                campaign: { teamId: "team-1" },
            }));
            return records
                .filter((record) => record.mailboxId === args.where.mailboxId
                    && record.deliveryProvider === args.where.deliveryProvider
                    && record.teamId === args.where.campaign.teamId)
                .map(({ id, createdAt, threadId, providerId }) => ({ id, createdAt, threadId, providerId }));
        });
        mockFetch.mockImplementation(async (url: string) => {
            if (url.includes("/history")) return response({}, false, 404);
            if (url.includes("/messages/gmail-message-2")) return response({ id: "gmail-message-2", threadId: "gmail-thread-2" });
            if (url.includes("/threads/gmail-thread-1") || url.includes("/threads/gmail-thread-2")) return response({ messages: [] });
            if (url.includes("/profile")) return response({ historyId: "202" });
            throw new Error(`unexpected URL ${url}`);
        });

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .resolves.toEqual({ synced: 0, replies: 0, bounces: 0 });

        const requestedUrls = mockFetch.mock.calls.map((call) => String(call[0]));
        expect(requestedUrls.some((url) => url.includes("smtp-message-id"))).toBe(false);
        expect(requestedUrls.some((url) => url.includes("legacy-message-id"))).toBe(false);
        expect(requestedUrls.some((url) => url.includes("other-team-message-id"))).toBe(false);
        expect(requestedUrls.some((url) => url.includes("/messages/gmail-message-2"))).toBe(true);
    });

    it("fails closed when recovery encounters an identifierless relevant outbound record", async () => {
        (prisma.email.findMany as Mock).mockResolvedValueOnce([{
            id: "email-without-provider-identity",
            createdAt: new Date("2026-01-01"),
            threadId: null,
            providerId: null,
        }]);
        mockFetch.mockResolvedValueOnce(response({}, false, 404));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .rejects.toBeInstanceOf(GmailRecoveryUnresolvableRecordError);
        expect((prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "IDLE",
        )).toBe(false);
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("fails recovery closed on elapsed-time exhaustion and leaves the cursor unchanged", async () => {
        mockFetch.mockResolvedValueOnce(response({}, false, 404));
        const ownedLease = lease();
        const tokenCheckTime = Date.now();
        vi.spyOn(Date, "now")
            .mockReturnValueOnce(tokenCheckTime)
            .mockReturnValueOnce(0)
            .mockReturnValue(8 * 60 * 1000 + 1);

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: ownedLease }))
            .rejects.toBeInstanceOf(GmailRecoveryLimitExceededError);
        expect(prisma.email.findMany).not.toHaveBeenCalled();
        expect((prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "IDLE",
        )).toBe(false);
    });

    it("stops recovery on a Gmail thread failure after awaited recovery heartbeats and leaves the cursor unchanged", async () => {
        (prisma.email.findMany as Mock).mockResolvedValueOnce([{
            id: "email-1",
            createdAt: new Date("2026-01-01"),
            threadId: "thread-1",
            providerId: "provider-1",
        }]);
        mockFetch.mockImplementation(async (url: string) => {
            if (url.includes("/history")) return response({}, false, 404);
            if (url.includes("/threads/thread-1")) return response({ error: {} }, false, 503);
            throw new Error(`unexpected URL ${url}`);
        });

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() })).rejects.toThrow();
        const renewals = (prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.filter(
            (call) => call[0]?.data?.lockExpiresAt instanceof Date,
        );
        expect(renewals.length).toBeGreaterThanOrEqual(3);
        expect((prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "IDLE",
        )).toBe(false);
    });

    it("fetches Gmail data before one per-message transaction and keeps all coupled reply writes on its transaction client", async () => {
        const order: string[] = [];
        const eventTx = {
            $queryRaw: vi.fn(async () => { order.push("lease-assert"); return [{ id: "cursor-1" }]; }),
            email: { findFirst: vi.fn().mockResolvedValue({ id: "email-1", leadId: "lead-1", campaignId: "campaign-1" }), update: vi.fn().mockResolvedValue({}) },
            emailEvent: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockImplementation(async () => { order.push("event-create"); return { id: "event-1" }; }), update: vi.fn().mockResolvedValue({}) },
            message: { create: vi.fn().mockResolvedValue({}) },
            connectedMailbox: { update: vi.fn().mockResolvedValue({}) },
            lead: {
                update: vi.fn().mockResolvedValue({}),
                findUnique: vi.fn(),
                findFirst: vi.fn().mockResolvedValue({ id: "lead-1", status: "NEW", pipelineState: "COLD" }),
            },
            suppressionEntry: { upsert: vi.fn() },
        };
        const commitTx = {
            mailboxSyncCursor: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
            connectedMailbox: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        };
        (mockDb.$transaction as Mock)
            .mockImplementationOnce(async (callback: (tx: any) => unknown) => callback(eventTx))
            .mockImplementationOnce(async (callback: (tx: any) => unknown) => callback(commitTx));
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockImplementationOnce(async () => { order.push("gmail-message"); return response(replyMessage()); });

        await syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() });

        expect(order.indexOf("gmail-message")).toBeLessThan(order.indexOf("event-create"));
        expect(order.indexOf("lease-assert")).toBeLessThan(order.indexOf("event-create"));
        expect(eventTx.$queryRaw).toHaveBeenCalledTimes(1);
        expect(eventTx.emailEvent.create).toHaveBeenCalled();
        expect(eventTx.emailEvent.update).toHaveBeenCalledWith({
            where: { id: "event-1" },
            data: { processedAt: expect.any(Date) },
        });
        expect(eventTx.message.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ emailEventId: "event-1" }),
        }));
        expect(eventTx.connectedMailbox.update).toHaveBeenCalled();
        expect(eventTx.connectedMailbox.update).toHaveBeenCalledWith({
            where: { id: "mailbox-1" },
            data: { replyCount: { increment: 1 } },
        });
        expect(eventTx.email.update).toHaveBeenCalled();
        expect(eventTx.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "lead-1" }) }));
        expect(eventTx.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-1" },
            data: {
                status: "REPLIED",
                pipelineState: "HOT",
                pipelineStateChangedAt: expect.any(Date),
                hotAt: expect.any(Date),
            },
        });
        expect(prisma.emailEvent.create).not.toHaveBeenCalled();
        expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it("matches an inbound reply by wire providerId alone, independent of threadId (OPEN-05/OPEN-16)", async () => {
        // A same-thread reply would match via threadId regardless of providerId correctness,
        // which is exactly why a live send/reply cycle can't prove this fix. Here the thread
        // deliberately does not correspond to any stored Email, so a match is only possible if
        // the OR clause's providerId branch (sourced from the RFC 5322 In-Reply-To header) is
        // wired correctly against the wire Message-ID captured at send time.
        const reply = replyMessage();
        reply.threadId = "thread-with-no-matching-email";
        reply.payload.headers.find((h: { name: string }) => h.name === "In-Reply-To")!.value = "<wire-id@gmail.com>";
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(reply));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .resolves.toEqual({ synced: 1, replies: 1, bounces: 0 });

        expect(prisma.email.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                OR: expect.arrayContaining([{ threadId: "thread-with-no-matching-email" }, { providerId: "<wire-id@gmail.com>" }]),
            }),
        }));
    });

    it("writes the canonical STOPPED lead status for a Gmail hard bounce", async () => {
        const bounce = replyMessage();
        bounce.payload.headers[0].value = "Mailer-Daemon <mailer-daemon@example.com>";
        bounce.payload.headers[1].value = "Delivery failed";
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(bounce));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .resolves.toEqual({ synced: 1, replies: 0, bounces: 1 });

        expect(prisma.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-1" },
            data: { status: "STOPPED", updatedAt: expect.any(Date) },
        });
        expect(prisma.suppressionEntry.upsert).toHaveBeenCalled();
    });

    it("uses a transaction-client tagged row lock with exact mailbox, cursor, and token lease predicates", async () => {
        const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: "cursor-1" }]) };
        const owned = lease("100", "exact-lease-token");

        await assertGmailMailboxLeaseInTransaction(tx as any, owned);

        const [queryParts, ...parameters] = tx.$queryRaw.mock.calls[0];
        const query = Array.from(queryParts as TemplateStringsArray).join("?");
        expect(query).toContain('FROM "MailboxSyncCursor"');
        expect(query).toContain('"mailboxId" = ?');
        expect(query).toContain('"cursorType" = ?');
        expect(query).toContain('"lockToken" = ?');
        expect(query).toContain('"status" = \'RUNNING\'');
        expect(query).toContain('"lockExpiresAt" IS NOT NULL');
        expect(query).toContain('"lockExpiresAt" > CURRENT_TIMESTAMP');
        expect(query).toContain("FOR UPDATE");
        expect(parameters).toEqual(["mailbox-1", "GMAIL_HISTORY", "exact-lease-token"]);
    });

    it.each([
        ["missing cursor", []],
        ["expired or null expiry", []],
        ["token mismatch", []],
    ])("rejects a %s transaction-local lease match before any event mutation", async (_caseName, rows) => {
        const tx = { $queryRaw: vi.fn().mockResolvedValue(rows) };

        await expect(assertGmailMailboxLeaseInTransaction(tx as any, lease())).rejects.toBeInstanceOf(GmailMailboxLeaseLostError);
    });

    it("locks the cursor before bounce EmailEvent creation and keeps Gmail HTTP outside the event transaction", async () => {
        const order: string[] = [];
        (mockDb.$queryRaw as Mock).mockImplementation(async () => {
            order.push(`lease-after-${mockFetch.mock.calls.length}-fetches`);
            return [{ id: "cursor-1" }];
        });
        (prisma.emailEvent.create as Mock).mockImplementation(async () => {
            order.push("bounce-event-create");
            return { id: "event-1" };
        });
        const bounce = replyMessage();
        bounce.payload.headers[0].value = "Mailer-Daemon <mailer-daemon@example.com>";
        bounce.payload.headers[1].value = "Delivery failed";
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(bounce));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .resolves.toEqual({ synced: 1, replies: 0, bounces: 1 });

        expect(order).toEqual(["lease-after-2-fetches", "bounce-event-create"]);
        expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it.each([
        ["reply", () => replyMessage()],
        ["bounce", () => {
            const bounce = replyMessage();
            bounce.payload.headers[0].value = "Mailer-Daemon <mailer-daemon@example.com>";
            bounce.payload.headers[1].value = "Delivery failed";
            return bounce;
        }],
    ])("stops a delayed stale worker before %s event side effects after Gmail fetch completes", async (_type, makeMessage) => {
        (mockDb.$queryRaw as Mock).mockImplementation(async () => {
            expect(mockFetch).toHaveBeenCalledTimes(2);
            return [];
        });
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(makeMessage()));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .rejects.toBeInstanceOf(GmailMailboxLeaseLostError);

        expect(prisma.emailEvent.create).not.toHaveBeenCalled();
        expect(prisma.emailEvent.update).not.toHaveBeenCalled();
        expect(prisma.message.create).not.toHaveBeenCalled();
        expect(prisma.email.update).not.toHaveBeenCalled();
        expect(prisma.lead.update).not.toHaveBeenCalled();
        expect(prisma.connectedMailbox.update).not.toHaveBeenCalled();
        expect(prisma.suppressionEntry.upsert).not.toHaveBeenCalled();
        expect((prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "IDLE" || call[0]?.data?.lockToken === null,
        )).toBe(false);
    });

    it.each(["message", "email", "lead"])("rolls back the EmailEvent when the required %s write fails", async (failurePoint) => {
        const committedEvents: any[] = [];
        const pendingCompletionMarkers: any[] = [];
        (mockDb.$transaction as Mock).mockImplementationOnce(async (callback: (tx: any) => unknown) => {
            const pendingEvents: any[] = [];
            const fail = () => Promise.reject(new Error(`${failurePoint} failed`));
            const tx = {
                $queryRaw: vi.fn().mockResolvedValue([{ id: "cursor-1" }]),
                email: {
                    findFirst: vi.fn().mockResolvedValue({ id: "email-1", leadId: "lead-1", campaignId: "campaign-1" }),
                    update: failurePoint === "email" ? vi.fn(fail) : vi.fn().mockResolvedValue({}),
                },
                emailEvent: {
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn(async (args) => { pendingEvents.push(args); return {}; }),
                    update: vi.fn(async (args) => { pendingCompletionMarkers.push(args); }),
                },
                message: { create: failurePoint === "message" ? vi.fn(fail) : vi.fn().mockResolvedValue({}) },
                connectedMailbox: { update: vi.fn().mockResolvedValue({}) },
                lead: {
                    update: failurePoint === "lead" ? vi.fn(fail) : vi.fn().mockResolvedValue({}),
                    findUnique: vi.fn(),
                    findFirst: vi.fn().mockResolvedValue({ id: "lead-1", status: "NEW", pipelineState: "COLD" }),
                },
                suppressionEntry: { upsert: vi.fn() },
            };
            const result = await callback(tx);
            committedEvents.push(...pendingEvents);
            return result;
        });
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(replyMessage()));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() })).rejects.toThrow(`${failurePoint} failed`);
        expect(committedEvents).toEqual([]);
        expect(pendingCompletionMarkers).toEqual([]);
        expect((prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "IDLE",
        )).toBe(false);
    });

    it("allows a retry to recreate and commit the full event after a dependent-write rollback", async () => {
        (prisma.message.create as Mock)
            .mockRejectedValueOnce(new Error("message failed"))
            .mockResolvedValue({ id: "message-1" });
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(replyMessage()))
            .mockResolvedValueOnce(response({ historyId: "151", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(replyMessage()));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease("100", "first-token") }))
            .rejects.toThrow("message failed");
        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease("100", "retry-token") }))
            .resolves.toEqual({ synced: 1, replies: 1, bounces: 0 });

        expect(prisma.emailEvent.create).toHaveBeenCalledTimes(2);
        expect(prisma.message.create).toHaveBeenCalledTimes(2);
        expect(prisma.emailEvent.update).toHaveBeenCalledTimes(1);
        expect((prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "IDLE" && call[0]?.where?.lockToken === "retry-token",
        )).toBe(true);
    });

    it("rolls back bounce writes when required suppression fails", async () => {
        const committedEvents: any[] = [];
        const pendingCompletionMarkers: any[] = [];
        (mockDb.$transaction as Mock).mockImplementationOnce(async (callback: (tx: any) => unknown) => {
            const pendingEvents: any[] = [];
            const tx = {
                $queryRaw: vi.fn().mockResolvedValue([{ id: "cursor-1" }]),
                email: { findFirst: vi.fn().mockResolvedValue({ id: "email-1", leadId: "lead-1", campaignId: "campaign-1" }), update: vi.fn().mockResolvedValue({}) },
                emailEvent: {
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn(async (args) => { pendingEvents.push(args); return {}; }),
                    update: vi.fn(async (args) => { pendingCompletionMarkers.push(args); }),
                },
                message: { create: vi.fn().mockResolvedValue({}) },
                connectedMailbox: { update: vi.fn().mockResolvedValue({}) },
                lead: { update: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue({ email: "lead@example.com" }) },
                suppressionEntry: { upsert: vi.fn().mockRejectedValue(new Error("suppression failed")) },
            };
            const result = await callback(tx);
            committedEvents.push(...pendingEvents);
            return result;
        });
        const bounce = replyMessage();
        bounce.payload.headers[0].value = "Mailer-Daemon <mailer-daemon@example.com>";
        bounce.payload.headers[1].value = "Delivery failed";
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(bounce));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() })).rejects.toThrow("suppression failed");
        expect(committedEvents).toEqual([]);
        expect(pendingCompletionMarkers).toEqual([]);
    });

    it("treats only the intended EmailEvent unique constraint as a duplicate", async () => {
        const exactDuplicate = Object.assign(new Error("duplicate"), {
            code: "P2002",
            meta: { target: "EmailEvent_teamId_provider_providerMessageId_type_key" },
        });
        (prisma.emailEvent.findFirst as Mock)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "event-transactional", processedAt: null, message: null })
            .mockResolvedValueOnce({ id: "event-transactional", processedAt: new Date(), message: { id: "message-transactional" } });
        (prisma.emailEvent.create as Mock).mockRejectedValueOnce(exactDuplicate);
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(replyMessage()));
        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() })).resolves.toEqual({ synced: 0, replies: 0, bounces: 0 });
        expect(prisma.message.create).not.toHaveBeenCalled();

        vi.clearAllMocks();
        (mockDb.$transaction as Mock).mockImplementation(async (callback: (tx: any) => unknown) => callback(mockDb));
        (prisma.mailboxSyncCursor.updateMany as Mock).mockResolvedValue({ count: 1 });
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailbox());
        (prisma.email.findFirst as Mock).mockResolvedValue({ id: "email-1", leadId: "lead-1", campaignId: "campaign-1" });
        (prisma.emailEvent.findFirst as Mock).mockResolvedValue(null);
        const unrelated = Object.assign(new Error("other unique failure"), { code: "P2002", meta: { target: ["trackingId"] } });
        (prisma.emailEvent.create as Mock).mockRejectedValueOnce(unrelated);
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "151", history: [{ messagesAdded: [{ message: { id: "inbound-2" } }] }] }))
            .mockResolvedValueOnce(response(replyMessage("inbound-2")));
        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() })).rejects.toThrow("other unique failure");
    });

    it("fails closed for a completed historic reply duplicate that lacks its required Message link", async () => {
        (prisma.emailEvent.findFirst as Mock).mockResolvedValueOnce({ id: "legacy-event", processedAt: new Date(), message: null });
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(replyMessage()));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .rejects.toBeInstanceOf(LegacyGmailEventAmbiguousError);
        expect(prisma.message.create).not.toHaveBeenCalled();
        expect((prisma.mailboxSyncCursor.updateMany as Mock).mock.calls.some(
            (call) => call[0]?.data?.status === "IDLE",
        )).toBe(false);
    });

    it("fails closed for a historic reply duplicate that lacks durable completion evidence", async () => {
        (prisma.emailEvent.findFirst as Mock).mockResolvedValueOnce({
            id: "legacy-reply-event",
            processedAt: null,
            message: { id: "message-1" },
        });
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(replyMessage()));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .rejects.toBeInstanceOf(LegacyGmailEventAmbiguousError);
        expect(prisma.message.create).not.toHaveBeenCalled();
        expect(prisma.connectedMailbox.update).not.toHaveBeenCalled();
    });

    it("accepts a completed reply duplicate only with its linked Message and does not increment counters", async () => {
        (prisma.emailEvent.findFirst as Mock).mockResolvedValueOnce({
            id: "completed-reply-event",
            processedAt: new Date(),
            message: { id: "message-1" },
        });
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(replyMessage()));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .resolves.toEqual({ synced: 0, replies: 0, bounces: 0 });

        expect(prisma.message.create).not.toHaveBeenCalled();
        expect(prisma.connectedMailbox.update).not.toHaveBeenCalled();
        expect(prisma.emailEvent.update).not.toHaveBeenCalled();
    });

    it("processes a new bounce without creating a Message and records completion evidence transactionally", async () => {
        const bounce = replyMessage();
        bounce.payload.headers[0].value = "Mailer-Daemon <mailer-daemon@example.com>";
        bounce.payload.headers[1].value = "Delivery failed";
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(bounce));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .resolves.toEqual({ synced: 1, replies: 0, bounces: 1 });

        expect(prisma.emailEvent.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ type: "BOUNCE", provider: "GMAIL_API" }),
        }));
        expect(prisma.message.create).not.toHaveBeenCalled();
        expect(prisma.connectedMailbox.update).toHaveBeenCalledWith({
            where: { id: "mailbox-1" },
            data: { bounceCount: { increment: 1 } },
        });
        expect(prisma.suppressionEntry.upsert).toHaveBeenCalledTimes(1);
        expect(prisma.emailEvent.update).toHaveBeenCalledWith({
            where: { id: "event-1" },
            data: { processedAt: expect.any(Date) },
        });
    });

    it("accepts a completed bounce duplicate without a Message or repeated non-idempotent writes", async () => {
        (prisma.emailEvent.findFirst as Mock).mockResolvedValueOnce({
            id: "completed-bounce-event",
            processedAt: new Date(),
            message: null,
        });
        const bounce = replyMessage();
        bounce.payload.headers[0].value = "Postmaster <postmaster@example.com>";
        bounce.payload.headers[1].value = "Undeliverable";
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(bounce));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .resolves.toEqual({ synced: 0, replies: 0, bounces: 0 });

        expect(prisma.message.create).not.toHaveBeenCalled();
        expect(prisma.connectedMailbox.update).not.toHaveBeenCalled();
        expect(prisma.suppressionEntry.upsert).not.toHaveBeenCalled();
        expect(prisma.emailEvent.update).not.toHaveBeenCalled();
    });

    it("fails closed for a historic bounce because completion evidence is absent, not because Message is absent", async () => {
        (prisma.emailEvent.findFirst as Mock).mockResolvedValueOnce({
            id: "legacy-bounce-event",
            processedAt: null,
            message: null,
        });
        const bounce = replyMessage();
        bounce.payload.headers[0].value = "Mailer-Daemon <mailer-daemon@example.com>";
        bounce.payload.headers[1].value = "Delivery failed";
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(bounce));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease() }))
            .rejects.toThrow("durable completion evidence");
        expect(prisma.message.create).not.toHaveBeenCalled();
        expect(prisma.connectedMailbox.update).not.toHaveBeenCalled();
        expect(prisma.suppressionEntry.upsert).not.toHaveBeenCalled();
    });

    it("retries a rolled-back bounce once and writes its completion marker only for the winning transaction", async () => {
        const bounce = replyMessage();
        bounce.payload.headers[0].value = "Mailer-Daemon <mailer-daemon@example.com>";
        bounce.payload.headers[1].value = "Delivery failed";
        let eventTransactions = 0;
        let committedBounceIncrements = 0;
        let committedCompletionMarkers = 0;
        (mockDb.$transaction as Mock).mockImplementation(async (callback: (tx: any) => unknown) => {
            if (eventTransactions >= 2) return callback(mockDb);
            const failThisTransaction = eventTransactions++ === 0;
            let pendingBounceIncrements = 0;
            let pendingCompletionMarkers = 0;
            const tx = {
                $queryRaw: vi.fn().mockResolvedValue([{ id: "cursor-1" }]),
                email: {
                    findFirst: vi.fn().mockResolvedValue({ id: "email-1", leadId: "lead-1", campaignId: "campaign-1" }),
                    update: vi.fn().mockResolvedValue({}),
                },
                emailEvent: {
                    findFirst: vi.fn().mockResolvedValue(null),
                    create: vi.fn().mockResolvedValue({ id: "event-1" }),
                    update: vi.fn(async () => { pendingCompletionMarkers += 1; }),
                },
                message: { create: vi.fn().mockResolvedValue({}) },
                connectedMailbox: {
                    update: vi.fn(async (args) => {
                        if (args.data?.bounceCount?.increment === 1) pendingBounceIncrements += 1;
                    }),
                },
                lead: { findUnique: vi.fn().mockResolvedValue({ email: "lead@example.com" }), update: vi.fn().mockResolvedValue({}) },
                suppressionEntry: {
                    upsert: failThisTransaction
                        ? vi.fn().mockRejectedValue(new Error("suppression failed"))
                        : vi.fn().mockResolvedValue({ id: "suppression-1" }),
                },
            };
            try {
                const result = await callback(tx);
                committedBounceIncrements += pendingBounceIncrements;
                committedCompletionMarkers += pendingCompletionMarkers;
                return result;
            } catch (error) {
                throw error;
            }
        });
        mockFetch
            .mockResolvedValueOnce(response({ historyId: "150", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(bounce))
            .mockResolvedValueOnce(response({ historyId: "151", history: [{ messagesAdded: [{ message: { id: "inbound-1" } }] }] }))
            .mockResolvedValueOnce(response(bounce));

        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease("100", "first-token") }))
            .rejects.toThrow("suppression failed");
        await expect(syncGoogleMailbox("team-1", "mailbox-1", { lease: lease("100", "retry-token") }))
            .resolves.toEqual({ synced: 1, replies: 0, bounces: 1 });

        expect(committedBounceIncrements).toBe(1);
        expect(committedCompletionMarkers).toBe(1);
    });

    it("uses the bounded helper for successful Gmail send and preserves message and thread identifiers", async () => {
        mockFetch
            .mockResolvedValueOnce(response({ id: "gmail-message-1", threadId: "gmail-thread-1" }))
            .mockResolvedValueOnce(response({ payload: { headers: [{ name: "Message-ID", value: "<wire-id@gmail.com>" }] } }));

        await expect(sendViaGmailMailbox({
            teamId: "team-1",
            mailboxId: "mailbox-1",
            to: "recipient@example.com",
            subject: "Hello",
            html: "<p>content</p>",
        })).resolves.toEqual({
            success: true,
            deliveryProvider: "GMAIL_API",
            messageId: "<wire-id@gmail.com>",
            threadId: "gmail-thread-1",
            mailboxId: "mailbox-1",
        });

        expect(mockFetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it("falls back to the client-generated RFC Message-ID when the post-send wire fetch fails", async () => {
        mockFetch
            .mockResolvedValueOnce(response({ id: "gmail-message-1", threadId: "gmail-thread-1" }))
            .mockResolvedValueOnce(response({ error: { message: "lookup failed" } }, false, 500));

        const result = await sendViaGmailMailbox({
            teamId: "team-1",
            mailboxId: "mailbox-1",
            to: "recipient@example.com",
            subject: "Hello",
            html: "<p>content</p>",
        });

        expect(result).toMatchObject({ success: true, deliveryProvider: "GMAIL_API", threadId: "gmail-thread-1" });
        expect((result as { messageId: string }).messageId).toMatch(/^<[^@]+@example\.com>$/);
    });

    it("returns only safe Gmail send failure codes for provider failures and malformed responses", async () => {
        mockFetch
            .mockResolvedValueOnce(response({ error: { message: "recipient@example.com MIME body access-token" } }, false, 500))
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new Error("raw Gmail response MIME body"); } })
            .mockResolvedValueOnce(response({ threadId: "thread-without-message-id" }));

        await expect(sendViaGmailMailbox({ teamId: "team-1", mailboxId: "mailbox-1", to: "recipient@example.com", subject: "Hello", html: "<p>content</p>" }))
            .resolves.toEqual({ success: false, error: "GMAIL_SEND_FAILED", outcome: "AMBIGUOUS", fallbackAllowed: false });
        await expect(sendViaGmailMailbox({ teamId: "team-1", mailboxId: "mailbox-1", to: "recipient@example.com", subject: "Hello", html: "<p>content</p>" }))
            .resolves.toEqual({ success: false, error: "GMAIL_SEND_RESPONSE_INVALID", outcome: "AMBIGUOUS", fallbackAllowed: false });
        await expect(sendViaGmailMailbox({ teamId: "team-1", mailboxId: "mailbox-1", to: "recipient@example.com", subject: "Hello", html: "<p>content</p>" }))
            .resolves.toEqual({ success: false, error: "GMAIL_SEND_RESPONSE_INVALID", outcome: "AMBIGUOUS", fallbackAllowed: false });
    });

    it.each([400, 401, 403, 429])("classifies Gmail HTTP %s as an explicit rejection that permits fallback", async (status) => {
        mockFetch.mockResolvedValueOnce(response({ error: { message: "provider detail must remain private" } }, false, status));

        await expect(sendViaGmailMailbox({
            teamId: "team-1",
            mailboxId: "mailbox-1",
            to: "recipient@example.com",
            subject: "Hello",
            html: "<p>content</p>",
        })).resolves.toEqual({
            success: false,
            error: "GMAIL_SEND_REJECTED",
            outcome: "EXPLICIT_REJECTION",
            fallbackAllowed: true,
        });
    });

    it("classifies a non-JSON Gmail HTTP 400 response as an explicit rejection", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => { throw new Error("provider body must remain private"); },
        });

        await expect(sendViaGmailMailbox({
            teamId: "team-1",
            mailboxId: "mailbox-1",
            to: "recipient@example.com",
            subject: "Hello",
            html: "<p>content</p>",
        })).resolves.toEqual({
            success: false,
            error: "GMAIL_SEND_REJECTED",
            outcome: "EXPLICIT_REJECTION",
            fallbackAllowed: true,
        });
    });

    it("aborts a hung Gmail send and returns its safe timeout code", async () => {
        vi.useFakeTimers();
        let notifyFetchStarted!: () => void;
        const fetchStarted = new Promise<void>((resolve) => { notifyFetchStarted = resolve; });
        mockFetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            notifyFetchStarted();
            init.signal?.addEventListener("abort", () => reject(new Error("recipient@example.com MIME payload access-token")), { once: true });
        }));

        const sending = sendViaGmailMailbox({ teamId: "team-1", mailboxId: "mailbox-1", to: "recipient@example.com", subject: "Hello", html: "<p>content</p>" });
        await fetchStarted;
        await vi.advanceTimersByTimeAsync(60_000);

        await expect(sending).resolves.toEqual({
            success: false,
            error: "GMAIL_SEND_TIMEOUT",
            outcome: "AMBIGUOUS",
            fallbackAllowed: false,
        });
    });

    it("treats a Gmail transport failure as ambiguous and forbids fallback", async () => {
        mockFetch.mockRejectedValueOnce(new Error("network detail must remain private"));

        await expect(sendViaGmailMailbox({
            teamId: "team-1",
            mailboxId: "mailbox-1",
            to: "recipient@example.com",
            subject: "Hello",
            html: "<p>content</p>",
        })).resolves.toEqual({
            success: false,
            error: "GMAIL_SEND_FAILED",
            outcome: "AMBIGUOUS",
            fallbackAllowed: false,
        });
    });

    it("classifies a missing selected mailbox as a definite pre-dispatch failure", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValueOnce(null);

        await expect(sendViaGmailMailbox({
            teamId: "team-1",
            mailboxId: "mailbox-1",
            to: "recipient@example.com",
            subject: "Hello",
            html: "<p>content</p>",
        })).resolves.toEqual({
            success: false,
            error: "GMAIL_SEND_PRE_DISPATCH_FAILED",
            outcome: "PRE_DISPATCH_NO_SEND",
            fallbackAllowed: true,
        });
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("keeps a valid Gmail success authoritative when mailbox send bookkeeping fails", async () => {
        mockFetch
            .mockResolvedValueOnce(response({ id: "gmail-message-1", threadId: "gmail-thread-1" }))
            .mockResolvedValueOnce(response({ payload: { headers: [{ name: "Message-ID", value: "<wire-id@gmail.com>" }] } }));
        (prisma.connectedMailbox.update as Mock).mockRejectedValueOnce(new Error("database detail must remain private"));

        await expect(sendViaGmailMailbox({
            teamId: "team-1",
            mailboxId: "mailbox-1",
            to: "recipient@example.com",
            subject: "Hello",
            html: "<p>content</p>",
        })).resolves.toEqual({
            success: true,
            deliveryProvider: "GMAIL_API",
            messageId: "<wire-id@gmail.com>",
            threadId: "gmail-thread-1",
            mailboxId: "mailbox-1",
        });
    });

    it("uses the bounded helper for Gmail watch registration and stores valid watch evidence", async () => {
        vi.stubEnv("GOOGLE_PUBSUB_TOPIC_NAME", "projects/example/topics/test");
        (prisma.connectedMailbox.update as Mock).mockResolvedValue({ ...mailbox(), historyId: "200" });
        mockFetch.mockResolvedValueOnce(response({ historyId: "200", expiration: "1893456000000" }));

        await expect(registerGoogleMailboxWatch("team-1", "mailbox-1")).resolves.toEqual(expect.objectContaining({
            mailboxId: "mailbox-1",
            historyId: "200",
            watchExpirationAt: new Date(1893456000000),
        }));

        expect(mockFetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
        expect((prisma.connectedMailbox.update as Mock).mock.calls[0][0].data.metadata.lastWatchError).toBeNull();
    });

    it.each([
        ["HTTP failure", response({ error: { message: "provider error_description access-token refresh-token" } }, false, 500), "GMAIL_WATCH_FAILED"],
        ["invalid JSON", { ok: true, status: 200, json: async () => { throw new Error("provider response text access-token refresh-token"); } }, "GMAIL_WATCH_RESPONSE_INVALID"],
    ])("persists only a stable code for Gmail watch %s", async (_caseName, watchResponse, errorCode) => {
        vi.stubEnv("GOOGLE_PUBSUB_TOPIC_NAME", "projects/example/topics/test");
        (prisma.connectedMailbox.findMany as Mock).mockResolvedValue([mailbox()]);
        mockFetch.mockResolvedValueOnce(watchResponse);

        await expect(renewDueGoogleMailboxWatches(1)).resolves.toEqual([{
            mailboxId: "mailbox-1",
            teamId: "team-1",
            renewed: false,
            error: errorCode,
        }]);

        const persistedMetadata = (prisma.connectedMailbox.update as Mock).mock.calls.at(-1)?.[0].data.metadata;
        expect(persistedMetadata.lastWatchError).toBe(errorCode);
        expect(JSON.stringify(persistedMetadata)).not.toContain("provider");
        expect(JSON.stringify(persistedMetadata)).not.toContain("access-token");
        expect(JSON.stringify(persistedMetadata)).not.toContain("refresh-token");
    });

    it("aborts a hung Gmail watch and persists only GMAIL_WATCH_TIMEOUT", async () => {
        vi.useFakeTimers();
        vi.stubEnv("GOOGLE_PUBSUB_TOPIC_NAME", "projects/example/topics/test");
        (prisma.connectedMailbox.findMany as Mock).mockResolvedValue([mailbox()]);
        let notifyFetchStarted!: () => void;
        const fetchStarted = new Promise<void>((resolve) => { notifyFetchStarted = resolve; });
        mockFetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
            notifyFetchStarted();
            init.signal?.addEventListener("abort", () => reject(new Error("provider body access-token refresh-token")), { once: true });
        }));

        const renewal = renewDueGoogleMailboxWatches(1);
        await fetchStarted;
        await vi.advanceTimersByTimeAsync(60_000);

        await expect(renewal).resolves.toEqual([{
            mailboxId: "mailbox-1",
            teamId: "team-1",
            renewed: false,
            error: "GMAIL_WATCH_TIMEOUT",
        }]);
        const persistedMetadata = (prisma.connectedMailbox.update as Mock).mock.calls.at(-1)?.[0].data.metadata;
        expect(persistedMetadata.lastWatchError).toBe("GMAIL_WATCH_TIMEOUT");
    });

    it("applies the same exact EmailEvent P2002 constraint check to direct Pub/Sub handling", async () => {
        const data = Buffer.from(JSON.stringify({ emailAddress: "owner@example.com", historyId: "999" })).toString("base64url");
        (prisma.connectedMailbox.findMany as Mock).mockResolvedValue([mailbox()]);
        (prisma.emailEvent.findFirst as Mock).mockResolvedValue(null);
        const exactDuplicate = Object.assign(new Error("duplicate"), {
            code: "P2002",
            meta: { target: ["teamId", "provider", "providerMessageId", "type"] },
        });
        (prisma.emailEvent.create as Mock).mockRejectedValueOnce(exactDuplicate);
        await expect(handleGooglePubSubNotification({ data, messageId: "pubsub-1" })).resolves.toEqual({
            accepted: true,
            mailboxId: "mailbox-1",
            teamId: "team-1",
            duplicate: true,
        });

        const unrelated = Object.assign(new Error("other unique failure"), {
            code: "P2002",
            meta: { target: ["trackingId"] },
        });
        (prisma.emailEvent.create as Mock).mockRejectedValueOnce(unrelated);
        const result = await handleGooglePubSubNotification({ data, messageId: "pubsub-2" });
        expect(result).toEqual(expect.objectContaining({ accepted: false, reason: "PROCESSING_FAILURE" }));
    });

    it("throws loud error when registering watch for non-existent mailbox", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(null);
        await expect(registerGoogleMailboxWatch("team-1", "invalid-id")).rejects.toThrow("Mailbox not found.");
    });

    it("throws loud error when registering watch without GOOGLE_PUBSUB_TOPIC_NAME env var", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailbox());
        vi.stubEnv("GOOGLE_PUBSUB_TOPIC_NAME", "");
        await expect(registerGoogleMailboxWatch("team-1", "mailbox-1")).rejects.toThrow("GOOGLE_PUBSUB_TOPIC_NAME must be configured");
    });

    it("throws loud error with code GMAIL_WATCH_FAILED when watch registration HTTP response is non-200", async () => {
        vi.stubEnv("GOOGLE_PUBSUB_TOPIC_NAME", "projects/example/topics/test");
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailbox());
        mockFetch.mockResolvedValueOnce(response({ error: { message: "Permission denied" } }, false, 403));

        await expect(registerGoogleMailboxWatch("team-1", "mailbox-1")).rejects.toThrow("GMAIL_WATCH_FAILED");
    });

    it("throws loud error with code GMAIL_WATCH_RESPONSE_INVALID when historyId payload is invalid", async () => {
        vi.stubEnv("GOOGLE_PUBSUB_TOPIC_NAME", "projects/example/topics/test");
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailbox());
        mockFetch.mockResolvedValueOnce(response({ historyId: "" }, true, 200));

        await expect(registerGoogleMailboxWatch("team-1", "mailbox-1")).rejects.toThrow("GMAIL_WATCH_RESPONSE_INVALID");
    });

    it("advances warmup status for connected warming mailboxes", async () => {
        (prisma.connectedMailbox.updateMany as Mock).mockResolvedValue({ count: 2 });
        await expect(advanceMailboxWarmup()).resolves.toEqual({ count: 2 });
        expect(prisma.connectedMailbox.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ status: "CONNECTED", isWarmingUp: true }),
        }));
    });

    it("handles pre-existing emailEvent PubSub duplicate record found via findFirst", async () => {
        const data = Buffer.from(JSON.stringify({ emailAddress: "owner@example.com", historyId: "999" })).toString("base64url");
        (prisma.connectedMailbox.findMany as Mock).mockResolvedValue([mailbox()]);
        (prisma.emailEvent.findFirst as Mock).mockResolvedValue({ id: "existing-pubsub-event" });

        const result = await handleGooglePubSubNotification({ data, messageId: "pubsub-duplicate-1" });
        expect(result).toEqual({
            accepted: true,
            mailboxId: "mailbox-1",
            teamId: "team-1",
            duplicate: true,
        });
    });

    it("resolves AMBIGUOUS_MAILBOX when multiple connected mailboxes match the email address", async () => {
        const mb1 = mailbox();
        const mb2 = { ...mailbox(), id: "mailbox-2" };
        (prisma.connectedMailbox.findMany as Mock).mockResolvedValue([mb1, mb2]);

        await expect(resolveGoogleMailbox("owner@example.com")).resolves.toEqual({
            status: "AMBIGUOUS_MAILBOX",
        });
    });

    it("resolves UNKNOWN_MAILBOX when zero connected mailboxes match", async () => {
        (prisma.connectedMailbox.findMany as Mock).mockResolvedValue([]);

        await expect(resolveGoogleMailbox("unknown@example.com")).resolves.toEqual({
            status: "UNKNOWN_MAILBOX",
        });
    });

    it("catches sync failures during syncDueGoogleMailboxes and records lastSyncError", async () => {
        (prisma.connectedMailbox.findMany as Mock).mockResolvedValue([mailbox()]);
        (prisma.connectedMailbox.updateMany as Mock).mockResolvedValue({ count: 1 });
        (prisma.mailboxSyncCursor.findUnique as Mock).mockResolvedValue(null);
        // Force syncGoogleMailbox to fail by supplying non-matching mailbox provider or failure
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue({ ...mailbox(), provider: "SMTP" });

        const res = await syncDueGoogleMailboxes(1);
        expect(res).toEqual([{
            mailboxId: "mailbox-1",
            teamId: "team-1",
            synced: 0,
            replies: 0,
            bounces: 0,
            error: "GMAIL_SYNC_FAILED",
        }]);
    });
});



