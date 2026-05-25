import { NextRequest, NextResponse } from "next/server";
import { recordEmailUnsubscribe } from "@/modules/email-campaigner/service/trackingService";

export async function GET(req: NextRequest, { params }: { params: { trackingId: string } }) {
    try {
        await recordEmailUnsubscribe({ token: params.trackingId, headers: req.headers });
    } catch {
        return new NextResponse("Unsubscribe request recorded.", { status: 200 });
    }

    return new NextResponse("Unsubscribe request recorded.", { status: 200 });
}
