import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";

// Removes a placement-check test inbox. Only rows with status PLACEMENT; warmup seeds are never touched here.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { id } = await params;
    const { prisma } = await import("@/lib/db");
    const removed = await prisma.warmupSeedMailbox.deleteMany({ where: { id, status: "PLACEMENT" } });
    if (removed.count === 0) return NextResponse.json({ error: "Test inbox not found" }, { status: 404 });
    await auditSuperAdmin(actor, "PLACEMENT_INBOX_REMOVE", req, { id });
    return NextResponse.json({ ok: true });
}
