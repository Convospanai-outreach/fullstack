
import { NextResponse } from "next/server";
import { bulkService } from "@/modules/bulk/service/BulkService";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    const { userId } = await getCurrentContext();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { action, type, ids, payload } = await req.json();

    if (!ids || !ids.length) {
        return NextResponse.json({ success: false, message: "No items selected" });
    }

    try {
        let result;
        if (action === "delete") {
            result = await bulkService.deleteResources(type, ids);
        } else if (action === "tag") {
            result = await bulkService.tagResources(type, ids, payload?.tags || []);
        } else {
            return new NextResponse("Invalid action", { status: 400 });
        }

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
