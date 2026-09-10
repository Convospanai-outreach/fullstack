import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { datasetService } from "@/modules/training/DatasetService";

export async function POST(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { datasetId, record } = body;
    if (!datasetId || !record) {
        return NextResponse.json({ error: "datasetId and record required" }, { status: 400 });
    }

    const result = await datasetService.addRecord(datasetId, record);

    return NextResponse.json(result);
}
