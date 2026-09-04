
import { NextResponse } from "next/server";
import { bulkService } from "@/modules/bulk/service/BulkService";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return new NextResponse("Unauthorized", { status: 401 });

    const { action, type, ids, payload } = await req.json();

    if (!ids || !ids.length) {
        return NextResponse.json({ success: false, message: "No items selected" });
    }

    try {
        let result;
        if (action === "delete") {
            result = await bulkService.deleteResources(type, ids, teamId);
        } else if (action === "tag") {
            result = await bulkService.tagResources(type, ids, payload?.tags || [], teamId);
        } else {
            return new NextResponse("Invalid action", { status: 400 });
        }

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
