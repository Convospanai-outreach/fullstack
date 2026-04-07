import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/apiAuth";
import {
    ingestNetjanaSignal,
    validateNetjanaPayload,
    verifyNetjanaSignature,
} from "@/modules/intel/service/netjanaIntelService";

export async function POST(req: NextRequest) {
    const sourceHeader = req.headers.get("x-source")?.trim().toLowerCase();
    if (sourceHeader !== "netjana-intel") {
        return NextResponse.json({ error: "Invalid source" }, { status: 401 });
    }

    const auth = await validateApiKey(req, "leads:write");
    if (!auth?.teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.text();
    let payload: unknown;

    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (!validateNetjanaPayload(payload)) {
        return NextResponse.json({ error: "Payload does not match the Netjana signal contract" }, { status: 400 });
    }

    const hmacSecret = process.env["NETJANA_HMAC_SECRET"] || process.env["HMAC_SECRET"] || "";
    let signatureVerified = false;
    if (hmacSecret) {
        const signature = req.headers.get("x-netjana-signature");
        const timestamp = req.headers.get("x-netjana-timestamp");
        const nonce = req.headers.get("x-netjana-nonce");
        
        const isValidSignature = verifyNetjanaSignature(rawBody, signature, hmacSecret, timestamp, nonce);

        if (!isValidSignature) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        signatureVerified = true;
    }

    try {
        const result = await ingestNetjanaSignal(auth.teamId, payload as any, {
            signatureVerified,
            rawBody,
            nonce: req.headers.get("x-netjana-nonce"),
            timestamp: req.headers.get("x-netjana-timestamp"),
        });

        return NextResponse.json({
            ok: true,
            signalId: result.signal.signalId,
            leadId: result.leadId,
            campaignId: result.campaignId,
            duplicate: result.isDuplicate,
            followup: result.followup,
            connectionStatus: "connected",
            verificationMode: result.signal.verificationMode,
            matched: result.signal.matchStatus === "MATCHED",
            safeForAutomation: result.signal.safeForAutomation,
        });
    } catch (error: any) {
        console.error("[Netjana Intel] Webhook ingest failed", error);
        return NextResponse.json({ error: error.message || "Webhook ingest failed" }, { status: 500 });
    }
}
