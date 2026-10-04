import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { linkedInAvailable } from "@/modules/creator-funnel/linkedinConnect";

export const dynamic = "force-dynamic";

// Which LinkedIn connect buttons Settings > Social accounts should show.
export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const [profile, pages] = await Promise.all([linkedInAvailable("profile"), linkedInAvailable("pages")]);
        return NextResponse.json({ profile, pages });
    } catch (error) {
        console.error("[linkedin available]", error instanceof Error ? error.message : error);
        return NextResponse.json({ error: "Couldn't check LinkedIn availability." }, { status: 500 });
    }
}
