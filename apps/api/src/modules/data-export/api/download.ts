import { NextResponse } from "next/server";
import { exportService } from "../service/exportService";
import { getCurrentContext } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") as "leads" | "campaigns";

        if (!type || !["leads", "campaigns"].includes(type)) {
            return NextResponse.json({ ok: false, error: "Invalid type" }, { status: 400 });
        }

        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const csv = await exportService.generateCsv(type, teamId);

        return new NextResponse(csv, {
            headers: {
                "Content-Type": "text/csv",
                "Content-Disposition": `attachment; filename="${type}-${Date.now()}.csv"`,
            },
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err.message },
            { status: 500 }
        );
    }
}
