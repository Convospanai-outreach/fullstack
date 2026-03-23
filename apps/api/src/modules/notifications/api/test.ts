import { NextResponse } from "next/server";
import { notificationService } from "../service/notificationService";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, message } = body;

        if (!message) {
            return NextResponse.json({ ok: false, error: "Message required" }, { status: 400 });
        }

        const ctx = await getCurrentContext();
        if (!ctx.userId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const notification = await notificationService.sendAlert(ctx.userId, type || "info", message);
        return NextResponse.json({ ok: true, notification });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
