import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getAdminUser } from "@/lib/admin";
import { datasetService } from "@/modules/training/DatasetService";

export async function POST(req: NextRequest) {
    // Dataset review is a platform operation - SYSTEM_ADMIN only (S-05).
    const admin = await getAdminUser(UserRole.SYSTEM_ADMIN);
    if (!admin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { datasetId, sampleSize, scores } = body;
    if (!datasetId || !sampleSize || !scores) {
        return NextResponse.json({ error: "datasetId, sampleSize and scores required" }, { status: 400 });
    }

    const review = await datasetService.reviewDataset(datasetId, admin.id, sampleSize, scores);

    return NextResponse.json(review);
}
