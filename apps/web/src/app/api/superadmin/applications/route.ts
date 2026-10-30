import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";

export const APPLICATION_STATUSES = ["NEW", "REVIEWING", "SHORTLISTED", "REJECTED", "HIRED"] as const;
type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// Job applications: counts, and the newest 50 without their resume bytes.
export async function GET(req: NextRequest) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { prisma } = await import("@/lib/db");
    const [total, statusRows, latest] = await Promise.all([
        prisma.jobApplication.count(),
        prisma.jobApplication.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.jobApplication.findMany({
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
                id: true,
                jobTitle: true,
                name: true,
                email: true,
                phone: true,
                coverNote: true,
                status: true,
                resumeName: true,
                resumeSize: true,
                createdAt: true,
            },
        }),
    ]);

    const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<ApplicationStatus, number>;
    for (const row of statusRows) byStatus[row.status as ApplicationStatus] = row._count._all;

    // The list shows applicants' details, so each view is recorded (without them).
    await auditSuperAdmin(actor, "VIEW_APPLICATIONS", req, {});

    return NextResponse.json({ total, byStatus, latest });
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
    if (typeof id !== "string" || !id || typeof status !== "string" || !(APPLICATION_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json({ error: "An application id and a valid status are required" }, { status: 400 });
    }

    // Recorded first: if the record cannot be written, the status does not change.
    try {
        await auditSuperAdmin(actor, "APPLICATION_STATUS", req, { id, status });
    } catch {
        return NextResponse.json({ error: "Could not record the change" }, { status: 500 });
    }

    const { prisma } = await import("@/lib/db");
    try {
        const updated = await prisma.jobApplication.update({ where: { id }, data: { status: status as ApplicationStatus }, select: { id: true, status: true } });
        return NextResponse.json(updated);
    } catch (error) {
        if ((error as { code?: string }).code === "P2025") return NextResponse.json({ error: "Application not found" }, { status: 404 });
        throw error;
    }
}
