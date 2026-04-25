import { NextResponse } from "next/server";
import { aiService } from "@/lib/aiService";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { tone, goal, context, prompt } = body;
        const normalizedTone = typeof tone === "string" ? tone.trim().slice(0, 60) : "professional";
        const normalizedGoal = typeof goal === "string" ? goal.trim() : "";
        const normalizedContext = typeof context === "string" ? context.trim() : "";
        const normalizedPrompt = typeof prompt === "string" ? prompt.trim() : "";

        if (!normalizedGoal) {
            return NextResponse.json({ error: "Goal is required" }, { status: 400 });
        }
        if (normalizedGoal.length > 1000 || normalizedContext.length > 2500 || normalizedPrompt.length > 1500) {
            return NextResponse.json({ error: "Preview input is too long" }, { status: 400 });
        }

        // Construct a prompt for the AI
        const fullPrompt = `generate a ${normalizedTone} campaign message for the goal: ${normalizedGoal}.
        Context: ${normalizedContext}
        Additional Instructions: ${normalizedPrompt || "None"}
        
        Keep it concise and professional.`;

        const result = await aiService.askAI(fullPrompt, teamId, {
            taskType: "HELPER_PREVIEW",
            surface: "HELPER"
        });
        return NextResponse.json({ result });
    } catch (error: any) {
        console.error("AI Preview Error:", error);
        const message = error?.message || "Failed to generate preview";
        if (message.includes("Insufficient credits")) {
            return NextResponse.json({ error: message }, { status: 402 });
        }
        if (message.includes("prompt") || message.includes("not allowed") || message.includes("exceeds")) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to generate preview" },
            { status: 500 }
        );
    }
}
