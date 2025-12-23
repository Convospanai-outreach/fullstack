import { NextResponse } from "next/server";
import { AuditService } from "@/modules/audit/auditService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Basic admin check (Assuming hardcoded for now or based on role)
    // In real app, check user.role === 'admin'
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (user?.role !== "admin") {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const logs = await AuditService.getSystemLogs();
        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
