import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { prepareDripDraft } from "@/lib/dripIntelligence";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        const { id } = await params;
        const result = await prepareDripDraft({ teamId, requesterId: userId, campaignId: id });
        return NextResponse.json(result);
    } catch (error: any) {
        return handleAPIError(error);
    }
}

