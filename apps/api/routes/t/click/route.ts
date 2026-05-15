import { NextRequest, NextResponse } from "next/server";
import { recordClick } from "@/lib/emailTracking";

export async function GET(req: NextRequest) {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const link = await recordClick(token, {
        userAgent: req.headers.get("user-agent") || undefined,
        ip: req.headers.get("x-forwarded-for") || undefined,
    });
    if (!link) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
    return NextResponse.redirect(link.originalUrl);
}

