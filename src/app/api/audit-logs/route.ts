import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { auditService } from "@/modules/audit-logs/service/auditService";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Optional: Add Admin check here if 'role' exists on User
    // const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    // if (user?.role !== 'ADMIN') return new NextResponse("Forbidden", { status: 403 });

    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = parseInt(searchParams.get("offset") || "0");

        const logs = await auditService.getLogs(limit, offset);
        return NextResponse.json(logs);
    } catch (error) {
        console.error("Failed to fetch audit logs", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
