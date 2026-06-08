import { NextResponse } from "next/server";
import { FirmwareService } from "@/modules/security/FirmwareService";
import { prisma } from "@/lib/db";
import { AuditService } from "@/modules/audit/auditService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { nodeId, bootHash, runtimeVersion, buildHash, capabilities, vaultUnlocked } = body;

        if (!nodeId || !bootHash) {
            return NextResponse.json({ error: "Missing identity params" }, { status: 400 });
        }

        const node = await prisma.edgeNode.findUnique({ where: { id: nodeId } });
        if (!node) {
            return NextResponse.json({ error: "EDGE_NODE_UNKNOWN" }, { status: 404 });
        }
        if (node.revokedAt || node.status === "REVOKED") {
            return NextResponse.json({ error: "EDGE_NODE_REVOKED" }, { status: 403 });
        }

        // Verify the node is running authorized software
        const isTrusted = FirmwareService.verifyAttestation(nodeId, bootHash);

        if (!isTrusted) {
            await prisma.edgeNode.update({
                where: { id: node.id },
                data: {
                    status: "DISCONNECTED",
                    attestationStatus: "FAILED",
                    vaultState: "LOCKED",
                    removalReason: "attestation_failed",
                    lastSeenAt: new Date(),
                },
            });
            await AuditService.log(node.teamId, null, "edge_attestation_failed", "EdgeNode", node.id, {
                reason: "boot_hash_mismatch",
            });
            // [FAIL-CLOSED]
            // We return 403. The Edge Node should panic/reboot if it receives this.
            return NextResponse.json({
                error: "ATTESTATION_FAILED",
                message: "This node is not running signed firmware. Access Denied."
            }, { status: 403 });
        }

        // Issue a short-lived session token since verification passed
        const sessionToken = `session_${crypto.randomUUID()}`;
        const updated = await prisma.edgeNode.update({
            where: { id: node.id },
            data: {
                status: "ONLINE",
                attestationStatus: "TRUSTED",
                runtimeVersion: typeof runtimeVersion === "string" ? runtimeVersion : node.runtimeVersion,
                buildHash: typeof buildHash === "string" ? buildHash : node.buildHash,
                capabilities: capabilities && typeof capabilities === "object" ? capabilities : node.capabilities ?? undefined,
                vaultState: vaultUnlocked === true ? "UNLOCKED" : "LOCKED",
                lastSeenAt: new Date(),
                removalReason: null,
            },
        });

        await AuditService.log(node.teamId, null, "edge_node_online", "EdgeNode", node.id, {
            runtimeVersion: updated.runtimeVersion,
            buildHash: updated.buildHash,
            vaultState: updated.vaultState,
        });

        return NextResponse.json({
            ok: true,
            status: "TRUSTED",
            sessionToken,
            edgeNodeId: updated.id,
            vaultState: updated.vaultState,
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
