import { NextResponse } from "next/server";
import { AuditService } from "@/modules/audit/auditService";
import { checkAdmin } from "@/lib/admin";
import { logger } from "@/lib/logger";

export async function GET(_req: Request) {
    const isAdmin = await checkAdmin();
    if (!isAdmin) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const logs = await AuditService.getSystemLogs();
        return NextResponse.json({ success: true, logs });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[Admin API] Failed to fetch audit logs`, { error: errorMessage });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
