import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";

// Downloads one applicant's resume. It is always sent as an attachment with the type the upload check
// decided, and the download is recorded.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const { prisma } = await import("@/lib/db");
    const application = await prisma.jobApplication.findUnique({
        where: { id },
        select: { id: true, resumeName: true, resumeType: true, resumeData: true },
    });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    await auditSuperAdmin(actor, "DOWNLOAD_RESUME", req, { id });

    const safeName = application.resumeName.replace(/[^A-Za-z0-9._ -]/g, "_");
    return new Response(new Uint8Array(application.resumeData), {
        headers: {
            "content-type": application.resumeType,
            "content-disposition": `attachment; filename="${safeName}"`,
            "x-content-type-options": "nosniff",
            "cache-control": "no-store",
        },
    });
}
