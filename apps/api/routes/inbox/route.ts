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
        const status = url.searchParams.get("status");
        const platform = url.searchParams.get("platform");
        const search = url.searchParams.get("search");

        const filter: { status?: string; platform?: string; search?: string } = {};
        if (status) filter.status = status;
        if (platform) filter.platform = platform;
        if (search) filter.search = search;

        const conversations = await InboxService.getThreads(teamId, filter);

        return NextResponse.json(conversations);
    } catch (error) {
        console.error("Inbox Fetch Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
