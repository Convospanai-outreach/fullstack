import { NextResponse } from "next/server";
import { notificationService } from "../service/notificationService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, message } = body;

        if (!message) {
            return NextResponse.json({ ok: false, error: "Message required" }, { status: 400 });
        }

        const notification = await notificationService.sendAlert(type || "info", message);
        return NextResponse.json({ ok: true, notification });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
