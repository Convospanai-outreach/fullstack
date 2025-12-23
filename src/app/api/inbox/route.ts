import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { InboxService } from "@/lib/inboxService";

export async function GET(req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const url = new URL(req.url);
        const status = url.searchParams.get("status") || undefined;
        const platform = url.searchParams.get("platform") || undefined;
        const search = url.searchParams.get("search") || undefined;

        const conversations = await InboxService.getThreads(teamId, {
            status,
            platform,
            search
        });

        return NextResponse.json(conversations);
    } catch (error) {
        console.error("Inbox Fetch Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
