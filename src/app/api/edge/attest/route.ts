import { NextResponse } from "next/server";
import { FirmwareService } from "@/modules/security/FirmwareService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { nodeId, bootHash } = body;

        if (!nodeId || !bootHash) {
            return NextResponse.json({ error: "Missing identity params" }, { status: 400 });
        }

        // Verify the node is running authorized software
        const isTrusted = FirmwareService.verifyAttestation(nodeId, bootHash);

        if (!isTrusted) {
            // [FAIL-CLOSED]
            // We return 403. The Edge Node should panic/reboot if it receives this.
            return NextResponse.json({
                error: "ATTESTATION_FAILED",
                message: "This node is not running signed firmware. Access Denied."
            }, { status: 403 });
        }

        // Issue a short-lived session token since verification passed
        const sessionToken = `session_${crypto.randomUUID()}`;

        return NextResponse.json({
            ok: true,
            status: "TRUSTED",
            sessionToken
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
