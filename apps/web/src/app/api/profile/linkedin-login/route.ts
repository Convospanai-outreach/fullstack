import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { linkedInLoginConnected, linkedInLoginEnabled } from "@/lib/linkedinLogin";

export const dynamic = "force-dynamic";

// Whether Settings > General should offer "Connect LinkedIn", and whether it's already done.
export async function GET() {
    const userId = (await auth())?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const available = linkedInLoginEnabled();
    return NextResponse.json({ available, connected: available && (await linkedInLoginConnected(userId)) });
}
