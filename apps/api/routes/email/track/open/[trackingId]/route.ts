import { NextRequest, NextResponse } from "next/server";
import { recordEmailOpen } from "@/modules/email-campaigner/service/trackingService";

const PIXEL = Buffer.from(
    "R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
    "base64"
);

export async function GET(req: NextRequest, { params }: { params: { trackingId: string } }) {
    try {
        await recordEmailOpen({ token: params.trackingId, headers: req.headers });
    } catch {
        // Tracking pixels should not leak token validity or operational details.
    }

    return new NextResponse(PIXEL, {
        status: 200,
        headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
    });
}
