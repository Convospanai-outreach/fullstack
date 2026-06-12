import { afterEach, describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import {
    EdgeRuntimeError,
    getEdgeNodeStatusSnapshot,
    hashHardwareFingerprint,
    requireEdgePiiAvailable,
    verifyEdgeRequestSignature,
} from "../edgeRuntime";

const OLD_ENV = { ...process.env };

afterEach(() => {
    process.env = { ...OLD_ENV };
});

describe("edge runtime status", () => {
    it("marks a stale heartbeat as disconnected and fail-closed", () => {
        const now = new Date("2026-06-04T12:00:00.000Z");
        const snapshot = getEdgeNodeStatusSnapshot(
            {
                status: "ONLINE",
                attestationStatus: "TRUSTED",
                publicKey: "present",
                vaultState: "UNLOCKED",
                lastSeenAt: new Date("2026-06-04T11:58:00.000Z"),
            },
            { now, timeoutMs: 45_000 },
        );

        expect(snapshot.status).toBe("disconnected");
        expect(snapshot.online).toBe(false);
        expect(snapshot.failClosed).toBe(true);
        expect(snapshot.reason).toBe("EDGE_NODE_OFFLINE");
    });

    it("marks trusted fresh nodes as online", () => {
        const snapshot = getEdgeNodeStatusSnapshot(
            {
                status: "ONLINE",
                attestationStatus: "TRUSTED",
                publicKey: "present",
                vaultState: "UNLOCKED",
                lastSeenAt: new Date("2026-06-04T11:59:45.000Z"),
            },
            { now: new Date("2026-06-04T12:00:00.000Z"), timeoutMs: 45_000 },
        );

        expect(snapshot.status).toBe("online");
        expect(snapshot.online).toBe(true);
        expect(snapshot.failClosed).toBe(false);
    });

    it("requires pairing when edge-only PII mode is enabled", () => {
        process.env["EDGE_PII_MODE"] = "edge_only";

        const snapshot = getEdgeNodeStatusSnapshot(null);

        expect(snapshot.status).toBe("pairing_required");
        expect(snapshot.failClosed).toBe(true);
        expect(snapshot.reason).toBe("EDGE_NODE_REQUIRED");
    });
});

describe("requireEdgePiiAvailable", () => {
    it("throws EDGE_NODE_OFFLINE for stale edge-only nodes", async () => {
        const prisma = {
            edgeNode: {
                findUnique: async () => ({
                    status: "ONLINE",
                    attestationStatus: "TRUSTED",
                    publicKey: "present",
                    vaultState: "UNLOCKED",
                    lastSeenAt: new Date(Date.now() - 120_000),
                }),
            },
        };

        await expect(requireEdgePiiAvailable("team_1", prisma)).rejects.toMatchObject({
            code: "EDGE_NODE_OFFLINE",
            statusCode: 503,
        } satisfies Partial<EdgeRuntimeError>);
    });

    it("throws EDGE_DECRYPTION_UNAVAILABLE when the vault is locked", async () => {
        const prisma = {
            edgeNode: {
                findUnique: async () => ({
                    status: "ONLINE",
                    attestationStatus: "TRUSTED",
                    publicKey: "present",
                    vaultState: "LOCKED",
                    lastSeenAt: new Date(),
                }),
            },
        };

        await expect(requireEdgePiiAvailable("team_1", prisma)).rejects.toMatchObject({
            code: "EDGE_DECRYPTION_UNAVAILABLE",
            statusCode: 423,
        } satisfies Partial<EdgeRuntimeError>);
    });

    it("throws EDGE_NODE_REVOKED for revoked nodes", async () => {
        const prisma = {
            edgeNode: {
                findUnique: async () => ({
                    status: "REVOKED",
                    revokedAt: new Date(),
                    lastSeenAt: new Date(),
                }),
            },
        };

        await expect(requireEdgePiiAvailable("team_1", prisma)).rejects.toMatchObject({
            code: "EDGE_NODE_REVOKED",
            statusCode: 403,
        } satisfies Partial<EdgeRuntimeError>);
    });
});

describe("edge node identity", () => {
    it("hashes raw hardware fingerprints before cloud storage", () => {
        const first = hashHardwareFingerprint("usb-serial-123");
        const second = hashHardwareFingerprint("usb-serial-123");

        expect(first).toBe(second);
        expect(first).toMatch(/^[a-f0-9]{64}$/);
        expect(first).not.toContain("usb-serial-123");
    });

    it("verifies signed heartbeat payloads", () => {
        const { privateKey, publicKey } = generateKeyPairSync("rsa", {
            modulusLength: 2048,
            publicKeyEncoding: { type: "spki", format: "pem" },
            privateKeyEncoding: { type: "pkcs8", format: "pem" },
        });
        const rawBody = JSON.stringify({ vaultUnlocked: true });
        const timestamp = String(Date.now());
        const nonce = "nonce-1";
        const payload = `${timestamp}.${nonce}.${rawBody}`;
        const signatureHex = sign("sha256", Buffer.from(payload), privateKey).toString("hex");

        expect(verifyEdgeRequestSignature({
            publicKeyPem: publicKey,
            rawBody,
            timestamp,
            nonce,
            signatureHex,
        })).toBe(true);

        expect(verifyEdgeRequestSignature({
            publicKeyPem: publicKey,
            rawBody: JSON.stringify({ vaultUnlocked: false }),
            timestamp,
            nonce,
            signatureHex,
        })).toBe(false);
    });
});
