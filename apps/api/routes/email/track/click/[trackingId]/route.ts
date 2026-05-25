import { NextRequest, NextResponse } from "next/server";
import { recordEmailClick } from "@/modules/email-campaigner/service/trackingService";

export async function GET(req: NextRequest, { params }: { params: { trackingId: string } }) {
    try {
        const result = await recordEmailClick({ token: params.trackingId, headers: req.headers });
        if (!result.allowed) {
            return new NextResponse("Not found.", { status: 404 });
        }
        return NextResponse.redirect(result.destinationUrl);
    } catch {
        return new NextResponse("Not found.", { status: 404 });
    }
}
