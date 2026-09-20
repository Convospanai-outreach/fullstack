
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { serviceWatcher } from "@/modules/audit/ServiceWatcher";
import { checkAdmin } from "@/lib/admin";

export async function GET() {
    // Platform service health - SYSTEM_ADMIN only (S-05).
    const isAdmin = await checkAdmin(UserRole.SYSTEM_ADMIN);
    if (!isAdmin) {
        return new NextResponse("Unauthorized", { status: 403 });
    }

    try {
        const health = await serviceWatcher.getHealth();
        return NextResponse.json({
            success: true,
            health,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Health API] Failed to fetch service health", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
