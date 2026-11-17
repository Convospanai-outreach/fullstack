import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { settingsService } from "@/modules/settings/service/settingsService";
import { internalErrorMessage } from "@/lib/internalError";

export async function POST(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();

    // Validate? (e.g. check if keys look valid)

    try {
        await settingsService.updateSettings(userId, data);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return new NextResponse(internalErrorMessage(error), { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const masked = await settingsService.getSettingsForClient(userId);

    return NextResponse.json(masked);
}
