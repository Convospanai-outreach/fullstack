import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { AuditService } from "@/modules/audit/auditService";
import {
    getEdgeNodeStatusSnapshot,
    hashHardwareFingerprint,
    verifyEdgeSessionToken,
    verifyEdgeRequestSignature,
} from "@/lib/edgeRuntime";

function safeNode(node: any) {
    const snapshot = getEdgeNodeStatusSnapshot(node);
    return {
        id: node.id,
        teamId: node.teamId,
        status: snapshot.status,
        online: snapshot.online,
        failClosed: snapshot.failClosed,
        reason: snapshot.reason,
        runtimeVersion: node.runtimeVersion,
        buildHash: node.buildHash,
        capabilities: node.capabilities,
        piiStorageMode: node.piiStorageMode,
        vaultState: node.vaultState,
        attestationStatus: node.attestationStatus,
        lastSeenAt: node.lastSeenAt,
        pairedAt: node.pairedAt,
        revokedAt: node.revokedAt,
    };
}

async function requireAdminContext() {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) {
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return { error: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }) };
    }

    return { ctx };
}

export async function GET() {
    const auth = await requireAdminContext();
    if ("error" in auth) return auth.error;

    const node = await prisma.edgeNode.findUnique({ where: { teamId: auth.ctx.teamId } });
    if (!node) {
        return NextResponse.json({
            configured: false,
            status: getEdgeNodeStatusSnapshot(null),
        });
    }

    return NextResponse.json({
        configured: true,
        node: safeNode(node),
    });
}

export async function POST(req: Request) {
    const auth = await requireAdminContext();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const hardwareFingerprint = typeof body.hardwareFingerprint === "string" ? body.hardwareFingerprint.trim() : "";
    const publicKey = typeof body.publicKey === "string" ? body.publicKey.trim() : "";
    const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim().replace(/\/$/, "") : null;

    if (!hardwareFingerprint || !publicKey) {
        return NextResponse.json({ error: "hardwareFingerprint and publicKey are required" }, { status: 400 });
    }

    const hardwareFingerprintHash = hashHardwareFingerprint(hardwareFingerprint);
    const now = new Date();
    const node = await prisma.edgeNode.upsert({
        where: { teamId: auth.ctx.teamId },
        create: {
            teamId: auth.ctx.teamId,
            hardwareId: hardwareFingerprintHash,
            hardwareFingerprintHash,
            publicKey,
            ipAddress: endpoint,
            status: "ONLINE",
            attestationStatus: "PENDING",
            runtimeVersion: typeof body.runtimeVersion === "string" ? body.runtimeVersion : null,
            buildHash: typeof body.buildHash === "string" ? body.buildHash : null,
            capabilities: body.capabilities && typeof body.capabilities === "object" ? body.capabilities : undefined,
            piiStorageMode: "edge_only",
            vaultState: "LOCKED",
            lastSeenAt: now,
            pairedAt: now,
            revokedAt: null,
            removalReason: null,
        },
        update: {
            hardwareFingerprintHash,
            publicKey,
            ipAddress: endpoint,
            status: "ONLINE",
            attestationStatus: "PENDING",
            runtimeVersion: typeof body.runtimeVersion === "string" ? body.runtimeVersion : null,
            buildHash: typeof body.buildHash === "string" ? body.buildHash : null,
            capabilities: body.capabilities && typeof body.capabilities === "object" ? body.capabilities : undefined,
            piiStorageMode: "edge_only",
            vaultState: "LOCKED",
            lastSeenAt: now,
            pairedAt: now,
            revokedAt: null,
            removalReason: null,
        },
    });

    await AuditService.log(auth.ctx.teamId, auth.ctx.userId, "edge_node_paired", "EdgeNode", node.id, {
        runtimeVersion: node.runtimeVersion,
        buildHash: node.buildHash,
        piiStorageMode: node.piiStorageMode,
    });

    return NextResponse.json({ ok: true, node: safeNode(node) }, { status: 201 });
}

export async function PATCH(req: Request) {
    const auth = await requireAdminContext();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    if (body.action !== "revoke") {
        return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const node = await prisma.edgeNode.update({
        where: { teamId: auth.ctx.teamId },
        data: {
            status: "REVOKED",
            revokedAt: new Date(),
            removalReason: typeof body.reason === "string" ? body.reason.slice(0, 200) : "revoked_by_admin",
            vaultState: "LOCKED",
            sessionTokenHash: null,
            sessionTokenExpiresAt: null,
        },
    });

    await AuditService.log(auth.ctx.teamId, auth.ctx.userId, "edge_node_revoked", "EdgeNode", node.id, {
        reason: node.removalReason,
    });

    return NextResponse.json({ ok: true, node: safeNode(node) });
}

export async function PUT(req: Request) {
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};
    const nodeId = req.headers.get("x-edge-node-id") || body.nodeId;
    // A node paired via the admin dashboard (POST above) is never told its own
    // DB-assigned id, since pairing is driven by the admin's browser, not the
    // node itself - so the node authenticates its heartbeats by the hardware
    // fingerprint it already knows (the same one it submitted at pairing time,
    // hashed the same way) instead. x-edge-node-id is kept for callers that do
    // have the id (e.g. re-pairing tooling).
    const hardwareFingerprint = req.headers.get("x-edge-hardware-fingerprint") || body.hardwareFingerprint;
    const timestamp = req.headers.get("x-edge-timestamp") || "";
    const nonce = req.headers.get("x-edge-nonce") || "";
    const signature = req.headers.get("x-edge-signature") || "";
    const authorization = req.headers.get("authorization") || "";
    const bearerToken = authorization.toLowerCase().startsWith("bearer ")
        ? authorization.slice(7).trim()
        : "";
    const sessionToken = req.headers.get("x-edge-session-token") || bearerToken || body.sessionToken || "";

    if (!nodeId && !hardwareFingerprint) {
        return NextResponse.json({ error: "Missing edge node id or hardware fingerprint" }, { status: 400 });
    }

    const node = nodeId
        ? await prisma.edgeNode.findUnique({ where: { id: nodeId } })
        : await prisma.edgeNode.findUnique({ where: { hardwareFingerprintHash: hashHardwareFingerprint(hardwareFingerprint) } });
    if (!node || !node.publicKey) {
        return NextResponse.json({ error: "Unknown or unpaired edge node" }, { status: 404 });
    }
    if (node.revokedAt || node.status === "REVOKED") {
        return NextResponse.json({ error: "EDGE_NODE_REVOKED" }, { status: 403 });
    }

    const hasValidSession = verifyEdgeSessionToken(sessionToken, node);
    const hasSignedHeaders = Boolean(timestamp && nonce && signature);
    const signed = hasSignedHeaders && verifyEdgeRequestSignature({
        publicKeyPem: node.publicKey,
        rawBody,
        timestamp,
        nonce,
        signatureHex: signature,
    });

    if (!hasValidSession && !signed) {
        await AuditService.log(node.teamId, null, "edge_attestation_failed", "EdgeNode", node.id, {
            reason: hasSignedHeaders ? "invalid_heartbeat_auth" : "missing_heartbeat_auth",
        });
        return NextResponse.json({ error: "EDGE_ATTESTATION_FAILED" }, { status: 403 });
    }

    const updated = await prisma.edgeNode.update({
        where: { id: node.id },
        data: {
            status: "ONLINE",
            attestationStatus: "TRUSTED",
            runtimeVersion: typeof body.runtimeVersion === "string" ? body.runtimeVersion : node.runtimeVersion,
            buildHash: typeof body.buildHash === "string" ? body.buildHash : node.buildHash,
            capabilities: body.capabilities && typeof body.capabilities === "object" ? body.capabilities : node.capabilities ?? undefined,
            vaultState: body.vaultUnlocked === true ? "UNLOCKED" : "LOCKED",
            lastSeenAt: new Date(),
            removalReason: null,
        },
    });

    await AuditService.log(node.teamId, null, "edge_node_online", "EdgeNode", node.id, {
        runtimeVersion: updated.runtimeVersion,
        buildHash: updated.buildHash,
        vaultState: updated.vaultState,
    });

    return NextResponse.json({ ok: true, node: safeNode(updated) });
}
