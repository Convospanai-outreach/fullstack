import { NextRequest } from "next/server";
import { recordOpen, transparentGifResponse } from "@/lib/emailTracking";

export async function GET(req: NextRequest) {
    const token = new URL(req.url).searchParams.get("token");
    if (token) {
        await recordOpen(token, {
            userAgent: req.headers.get("user-agent") || undefined,
            ip: req.headers.get("x-forwarded-for") || undefined,
        }).catch(() => null);
    }
    return transparentGifResponse();
}

