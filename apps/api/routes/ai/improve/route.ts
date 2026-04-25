import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/aiService";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { text } = await req.json();
        if (typeof text !== "string" || !text.trim()) {
            return NextResponse.json({ error: "Text required" }, { status: 400 });
        }
        if (text.length > 4000) {
            return NextResponse.json({ error: "Text exceeds 4000 characters" }, { status: 400 });
        }

        const improved = await aiService.improveEmail(text, teamId);
        return NextResponse.json({ improved });
    } catch (error: any) {
        const message = error?.message || "AI Error";
        if (message.includes("Insufficient credits")) {
            return NextResponse.json({ error: message }, { status: 402 });
        }
        if (message.includes("prompt") || message.includes("not allowed") || message.includes("exceeds")) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        return NextResponse.json({ error: "AI Error" }, { status: 500 });
    }
}
