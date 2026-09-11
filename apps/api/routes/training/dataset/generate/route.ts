import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { syntheticDataService } from "@/modules/training/SyntheticDataService";

export async function POST(req: NextRequest) {
    const admin = await getAdminUser();
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { datasetId, taskType, count } = body;
    if (!datasetId || !taskType) {
        return NextResponse.json({ error: "datasetId and taskType required" }, { status: 400 });
    }

    const addedCount = await syntheticDataService.generateBatch(datasetId, taskType, count);

    return NextResponse.json({ addedCount });
}
