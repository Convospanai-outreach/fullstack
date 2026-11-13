import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Edge page + header chip data, read from the node's stored heartbeat (EdgeNode.lastSeenAt), not by calling
// the node: a node on a customer's premises is usually not reachable from the cloud.
// Freshness: green under 5 minutes, amber 5-30 minutes, red beyond that (or revoked / failed attestation).
// The hardware id is shortened before it leaves the API.
const GREEN_MS = 5 * 60 * 1000;
const AMBER_MS = 30 * 60 * 1000;

const shortenHardwareId = (id: string) => (id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id);

export async function GET() {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const node = await prisma.edgeNode.findUnique({ where: { teamId: ctx.teamId } });
    if (!node) return NextResponse.json({ success: true, data: { configured: false } });

    const revoked = Boolean(node.revokedAt) || node.status === "REVOKED";
    const failed = node.attestationStatus === "FAILED";
    const ageMs = node.lastSeenAt ? Math.max(0, Date.now() - node.lastSeenAt.getTime()) : null;
    const freshness = ageMs === null ? "red" : ageMs < GREEN_MS ? "green" : ageMs <= AMBER_MS ? "amber" : "red";
    const flags = node.capabilities && typeof node.capabilities === "object" ? (node.capabilities as Record<string, unknown>) : {};

    return NextResponse.json({
        success: true,
        data: {
            configured: true,
            state: revoked || failed ? "red" : freshness,
            reason: revoked ? "revoked" : failed ? "attestation_failed" : ageMs === null ? "no_heartbeat" : null,
            lastSeenAt: node.lastSeenAt ? node.lastSeenAt.toISOString() : null,
            hardwareId: shortenHardwareId(node.hardwareFingerprintHash ?? node.hardwareId),
            runtimeVersion: node.runtimeVersion,
            capabilities: {
                tokenize: flags["tokenize"] === true,
                classify: flags["classify"] === true,
                generate: flags["generate"] === true,
                execute: flags["execute"] === true,
            },
        },
    });
}
