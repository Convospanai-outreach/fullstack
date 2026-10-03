import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";
import { superAdminApi } from "@/lib/superadmin/apiClient";

// Puts a dead-lettered job back on the queue (apps/api admin/jobs/replay/[id]).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    try {
        const { status, body } = await superAdminApi(actor, "POST", `/admin/jobs/replay/${encodeURIComponent(id)}`);
        if (status >= 300) return NextResponse.json(body, { status });
        const job = body as { id?: string; type?: string; status?: string };
        await auditSuperAdmin(actor, "JOB_REPLAY", req, { jobId: id, type: job.type ?? null });
        // Only the fields the panel needs - the job payload can hold customer data.
        return NextResponse.json({ id: job.id, type: job.type, status: job.status });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upstream request failed";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
