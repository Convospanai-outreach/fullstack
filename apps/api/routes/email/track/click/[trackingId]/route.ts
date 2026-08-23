import { NextRequest, NextResponse } from "next/server";
import { recordEmailClick } from "@/modules/email-campaigner/service/trackingService";

export async function GET(req: NextRequest, { params }: { params: Promise<{ trackingId: string }> }) {
    try {
        const { trackingId } = await params;
        const result = await recordEmailClick({ token: trackingId, headers: req.headers });
        if (!result.allowed) {
            return new NextResponse("Not found.", { status: 404 });
        }
        return NextResponse.redirect(result.destinationUrl);
    } catch {
        return new NextResponse("Not found.", { status: 404 });
    }
}
