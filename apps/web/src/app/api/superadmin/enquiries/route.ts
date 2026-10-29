import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";

export const ENQUIRY_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "NOT_INTERESTED"] as const;
type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

const DAY = 24 * 60 * 60 * 1000;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Overview numbers for the website's enquiries. Days are UTC days. Everything time-based comes from one
// bounded read of the timestamps of the last 14 days or this month, whichever reaches further back.
export async function GET(req: NextRequest) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { prisma } = await import("@/lib/db");
    const now = new Date();
    const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const windowStart = Math.min(monthStart, todayStart - 13 * DAY);

    const [total, statusRows, recent, latest] = await Promise.all([
        prisma.enquiry.count(),
        prisma.enquiry.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.enquiry.findMany({ where: { createdAt: { gte: new Date(windowStart) } }, select: { createdAt: true }, take: 20000 }),
        prisma.enquiry.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, ticketId: true, name: true, email: true, subject: true, message: true, status: true, createdAt: true },
        }),
    ]);

    const byStatus = Object.fromEntries(ENQUIRY_STATUSES.map((s) => [s, 0])) as Record<EnquiryStatus, number>;
    for (const row of statusRows) byStatus[row.status as EnquiryStatus] = row._count._all;

    const perDay = new Map<string, number>();
    let today = 0;
    let yesterday = 0;
    let last7Days = 0;
    let thisMonth = 0;
    for (const { createdAt } of recent) {
        const at = createdAt.getTime();
        perDay.set(dayKey(at), (perDay.get(dayKey(at)) ?? 0) + 1);
        if (at >= todayStart) today++;
        else if (at >= todayStart - DAY) yesterday++;
        if (at >= todayStart - 6 * DAY) last7Days++;
        if (at >= monthStart) thisMonth++;
    }

    const daily = Array.from({ length: 14 }, (_, i) => {
        const date = dayKey(todayStart - (13 - i) * DAY);
        return { date, count: perDay.get(date) ?? 0 };
    });

    // The list shows visitors' details, so each view is recorded (without them).
    await auditSuperAdmin(actor, "VIEW_ENQUIRIES", req, {});

    return NextResponse.json({ today, yesterday, last7Days, thisMonth, total, waiting: byStatus.NEW, byStatus, daily, latest });
}

export async function PATCH(req: NextRequest) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    let body: { id?: unknown; status?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { id, status } = body;
    if (typeof id !== "string" || !id || typeof status !== "string" || !(ENQUIRY_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json({ error: "An enquiry id and a valid status are required" }, { status: 400 });
    }

    // Recorded first: if the record cannot be written, the status does not change.
    try {
        await auditSuperAdmin(actor, "ENQUIRY_STATUS", req, { id, status });
    } catch {
        return NextResponse.json({ error: "Could not record the change" }, { status: 500 });
    }

    const { prisma } = await import("@/lib/db");
    try {
        const updated = await prisma.enquiry.update({ where: { id }, data: { status: status as EnquiryStatus }, select: { id: true, status: true } });
        return NextResponse.json(updated);
    } catch (error) {
        if ((error as { code?: string }).code === "P2025") return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
        throw error;
    }
}
