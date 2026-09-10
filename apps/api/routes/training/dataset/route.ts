import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { datasetService } from "@/modules/training/DatasetService";

export async function POST(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const name = body.name || body.version;
    const teamId = body.teamId;
    const taskType = body.taskType || "TONE_NORMALIZATION";
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const dataset = await datasetService.createDataset(teamId, name, taskType);

    return NextResponse.json(dataset);
}
