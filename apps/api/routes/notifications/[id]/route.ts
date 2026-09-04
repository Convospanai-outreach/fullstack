import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await getCurrentContext();
    if (!ctx.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const result = await prisma.notification.updateMany({
        where: { id, userId: ctx.userId },
        data: { read: true },
    });

    if (result.count === 0) {
        return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}
