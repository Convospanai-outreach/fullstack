import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockVerifyAttestation, mockAuditLog, mockVerifyEdgeRequestSignature, mockHashEdgeSessionToken } = vi.hoisted(() => ({
    mockPrisma: {
        edgeNode: { findUnique: vi.fn(), update: vi.fn() },
    },
    mockVerifyAttestation: vi.fn(),
    mockAuditLog: vi.fn(),
    mockVerifyEdgeRequestSignature: vi.fn(),
    mockHashEdgeSessionToken: vi.fn(() => "hashed-token"),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/security/FirmwareService", () => ({
    FirmwareService: { verifyAttestation: mockVerifyAttestation },
}));
vi.mock("@/modules/audit/auditService", () => ({
    AuditService: { log: mockAuditLog },
}));
vi.mock("@/lib/edgeRuntime", () => ({
    hashEdgeSessionToken: mockHashEdgeSessionToken,
    verifyEdgeRequestSignature: mockVerifyEdgeRequestSignature,
}));

import { POST } from "./route";

function postRequest(body: unknown, headers: Record<string, string> = {}) {
    return new Request("http://localhost/edge/attest", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    }) as any;
}

const SIGNED_HEADERS = {
    "x-edge-timestamp": "1234567890",
    "x-edge-nonce": "nonce-1",
    "x-edge-signature": "deadbeef",
};

describe("POST /edge/attest - requires the node's own signature, not just a shared boot hash (OPEN-223)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.edgeNode.findUnique.mockResolvedValue({
            id: "node-1",
            teamId: "team-1",
            publicKey: "pem-key",
            revokedAt: null,
            status: "OFFLINE",
        });
        mockPrisma.edgeNode.update.mockResolvedValue({
            id: "node-1",
            runtimeVersion: "1.0",
            buildHash: "abc",
            vaultState: "LOCKED",
        });
        mockVerifyAttestation.mockReturnValue(true);
    });

    it("rejects an attestation with no node signature, even with a correct boot hash - prevents attesting as another team's node by nodeId alone", async () => {
        const res = await POST(postRequest({ nodeId: "node-1", bootHash: "expected-hash" }));

        expect(res.status).toBe(403);
        expect(mockVerifyEdgeRequestSignature).not.toHaveBeenCalled();
        expect(mockVerifyAttestation).not.toHaveBeenCalled();
        expect(mockPrisma.edgeNode.update).not.toHaveBeenCalled();
    });

    it("rejects an attestation with an invalid node signature", async () => {
        mockVerifyEdgeRequestSignature.mockReturnValue(false);

        const res = await POST(postRequest({ nodeId: "node-1", bootHash: "expected-hash" }, SIGNED_HEADERS));

        expect(res.status).toBe(403);
        expect(mockVerifyAttestation).not.toHaveBeenCalled();
    });

    it("succeeds with a valid node signature and boot hash", async () => {
        mockVerifyEdgeRequestSignature.mockReturnValue(true);

        const res = await POST(postRequest({ nodeId: "node-1", bootHash: "expected-hash" }, SIGNED_HEADERS));

        expect(res.status).toBe(200);
        expect(mockVerifyAttestation).toHaveBeenCalledWith("node-1", "expected-hash");
        expect(mockPrisma.edgeNode.update).toHaveBeenCalled();
    });
});
