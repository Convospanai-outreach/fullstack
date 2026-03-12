
import { NextResponse } from "next/server";
import { serviceWatcher } from "@/modules/audit/ServiceWatcher";
import { checkAdmin } from "@/lib/admin";

export async function GET() {
    const isAdmin = await checkAdmin();
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
