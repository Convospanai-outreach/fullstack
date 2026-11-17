import { NextResponse } from "next/server";
import { onboardingService } from "../service/onboardingService";
import { getCurrentContext } from "@/lib/auth";
import { internalErrorMessage } from "@/lib/internalError";

export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        
        if (!userId) {
            return NextResponse.json(
                { ok: false, error: "Unauthorized" },
                { status: 401 }
            );
        }

        const progress = await onboardingService.getOnboardingStatus(userId, teamId);
        return NextResponse.json({ ok: true, progress });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: internalErrorMessage(err) },
            { status: 500 }
        );
    }
}
