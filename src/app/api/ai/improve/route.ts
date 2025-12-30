import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/aiService";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { text } = await req.json();
        if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });

        const improved = await aiService.improveEmail(text);
        return NextResponse.json({ improved });
    } catch (error) {
        return NextResponse.json({ error: "AI Error" }, { status: 500 });
    }
}
