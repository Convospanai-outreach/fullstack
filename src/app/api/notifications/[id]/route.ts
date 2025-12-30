import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    await prisma.notification.update({
        where: { id },
        data: { read: true },
    });

    return NextResponse.json({ ok: true });
}
