import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

/**
 * Enqueues Chromium-based PDF rendering onto the worker instead of running it
 * synchronously in this (api) container - roadmap.md item 1.6. The client
 * polls GET /jobs/[id] for the result. idempotencyKey means repeat downloads
 * of the same (immutable) invoice reuse the same rendered job.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(userId, teamId, TeamRole.ADMIN);

    const invoice = await prisma.invoice.findFirst({ where: { id, teamId }, select: { id: true } });
    if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const job = await JobQueue.enqueue(
        "invoice_pdf_render",
        { invoiceId: id, teamId },
        { teamId, idempotencyKey: `invoice_pdf_${id}` }
    );

    return NextResponse.json({ jobId: job.id, status: job.status });
}
