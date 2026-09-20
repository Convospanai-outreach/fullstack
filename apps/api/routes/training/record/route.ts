import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { datasetService } from "@/modules/training/DatasetService";

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!teamId) return NextResponse.json({ error: "No active team" }, { status: 403 });

    const body = await req.json();
    const { datasetId, record } = body;
    if (!datasetId || !record) {
        return NextResponse.json({ error: "datasetId and record required" }, { status: 400 });
    }

    const result = await datasetService.addRecord(datasetId, record, teamId);
    if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to add record" }, { status: 404 });
    }

    return NextResponse.json(result);
}
