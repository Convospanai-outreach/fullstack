import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { datasetService } from "@/modules/training/DatasetService";

export async function GET(req: NextRequest) {
    const { userId } = await getCurrentContext();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId") || "";

    const datasets = await datasetService.listDatasets(teamId);

    return NextResponse.json(datasets);
}
