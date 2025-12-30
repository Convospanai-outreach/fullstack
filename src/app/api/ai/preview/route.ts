import { NextResponse } from "next/server";
import { aiService } from "@/lib/aiService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { tone, goal, context, prompt } = body;

        // Construct a prompt for the AI
        const fullPrompt = `generate a ${tone} campaign message for the goal: ${goal}.
        Context: ${context}
        Additional Instructions: ${prompt || "None"}
        
        Keep it concise and professional.`;

        const result = await aiService.askAI(fullPrompt);
        return NextResponse.json({ result });
    } catch (error: any) {
        console.error("AI Preview Error:", error);
        return NextResponse.json(
            { error: "Failed to generate preview" },
            { status: 500 }
        );
    }
}
