import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { notificationService } from "@/modules/notifications/service/notificationService";
import { prisma } from "@/lib/db";

export async function GET() {
    const ctx = await getCurrentContext();
    if (!ctx.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const notifications = await notificationService.list(ctx.userId);
    return NextResponse.json({ notifications });
}

export async function POST(req: Request) {
    const ctx = await getCurrentContext();
    if (!ctx.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { type, message, meta } = body || {};
    if (!message) {
        return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const notification = await notificationService.sendAlert(ctx.userId, type || "info", message, meta);
    return NextResponse.json({ notification });
}

export async function PATCH(req: Request) {
    const ctx = await getCurrentContext();
    if (!ctx.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    const markAll = body?.all === true;

    if (!markAll && ids.length === 0) {
        return NextResponse.json({ error: "No notifications specified" }, { status: 400 });
    }

    const result = await prisma.notification.updateMany({
        where: {
            userId: ctx.userId,
            ...(markAll ? { read: false } : { id: { in: ids } })
        },
        data: { read: true }
    });

    return NextResponse.json({ updated: result.count });
}
