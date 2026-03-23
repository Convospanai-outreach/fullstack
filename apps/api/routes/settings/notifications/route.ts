import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { settingsService } from "@/modules/settings/service/settingsService";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();

    try {
        await settingsService.updateNotifications(session.user.id, data);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}

export async function GET(_req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const settings = await settingsService.getSettings(session.user.id);
        return NextResponse.json(settings.notifications || {});
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
