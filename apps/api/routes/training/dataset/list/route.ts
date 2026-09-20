import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { datasetService } from "@/modules/training/DatasetService";

export async function GET(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!teamId) return NextResponse.json({ error: "No active team" }, { status: 403 });

    const datasets = await datasetService.listDatasets(teamId);

    return NextResponse.json(datasets);
}
