import { NextResponse } from "next/server";
import { AuditService } from "@/modules/audit/auditService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    // Validate access to campaign (omitted for brevity, usually check teamId)

    try {
        const activities = await AuditService.getResourceActivity("Campaign", params.id);
        return NextResponse.json({ success: true, activities });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
