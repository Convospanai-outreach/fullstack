import { NextResponse } from "next/server";
import { AuditService } from "@/modules/audit/auditService";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";

export async function GET(req: Request) {
    try {
        const { userId } = await getCurrentContext();
        if (!userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const currentUser = await prisma.user.findUnique({ where: { id: userId } }) as any;
        if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "50");


        const logs = await AuditService.getSystemLogs(limit);

        return NextResponse.json({ logs, ok: true });
    } catch (error: any) {
        return handleAPIError(error);
    }
}
