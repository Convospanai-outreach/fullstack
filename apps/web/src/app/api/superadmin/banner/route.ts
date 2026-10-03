import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";

const LEVELS = ["info", "warning", "maintenance"];

export async function GET() {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { prisma } = await import("@/lib/db");
    const banner = await prisma.siteBanner.findUnique({ where: { id: "site" }, select: { message: true, level: true, active: true, updatedAt: true } });
    return NextResponse.json({ banner });
}

// { message, level, active }. Signed-in users see a change within about 30 seconds.
export async function PUT(req: NextRequest) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const input = (await req.json().catch(() => null)) as { message?: unknown; level?: unknown; active?: unknown } | null;
    const message = typeof input?.message === "string" ? input.message.trim() : "";
    const level = typeof input?.level === "string" ? input.level : "";
    if (typeof input?.active !== "boolean" || !LEVELS.includes(level) || message.length > 500 || (input.active && !message)) {
        return NextResponse.json({ error: "Give a message (up to 500 characters), a level (info, warning or maintenance) and active" }, { status: 400 });
    }

    const { prisma } = await import("@/lib/db");
    const data = { message, level, active: input.active, updatedById: actor.id };
    const banner = await prisma.siteBanner.upsert({
        where: { id: "site" },
        create: { id: "site", ...data },
        update: data,
        select: { message: true, level: true, active: true, updatedAt: true },
    });
    await auditSuperAdmin(actor, input.active ? "BANNER_SET" : "BANNER_OFF", req, { message, level });
    return NextResponse.json({ banner });
}
