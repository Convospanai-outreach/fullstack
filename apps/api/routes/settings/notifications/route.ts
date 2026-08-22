import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { settingsService } from "@/modules/settings/service/settingsService";

export async function POST(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();

    try {
        await settingsService.updateNotifications(userId, data);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const settings = await settingsService.getSettings(userId);
        return NextResponse.json(settings.notifications || {});
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
