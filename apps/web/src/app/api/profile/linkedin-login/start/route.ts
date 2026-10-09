import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildLinkedInLoginConnectUrl, linkedInLoginEnabled } from "@/lib/linkedinLogin";

export const dynamic = "force-dynamic";

// Starts Settings "Connect LinkedIn": the signed-in user picks the LinkedIn profile that may sign in as them.
export async function GET() {
    const userId = (await auth())?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!linkedInLoginEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ authUrl: buildLinkedInLoginConnectUrl(userId) });
}
