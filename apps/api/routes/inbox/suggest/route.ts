import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { InboxService } from "@/lib/inboxService";
import { aiService } from "@/lib/aiService";
import { prisma } from "@/lib/db";
import { LearningService } from "@/modules/learning/learningService";

export async function POST(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { leadId, tone } = body;

        if (!leadId) {
            return NextResponse.json({ error: "Missing leadId" }, { status: 400 });
        }

        // 1. Get Conversation Context
        const messages = await InboxService.getMessages(leadId);
        const context = messages.slice(-10).map(m => {
            return `${m.sender === 'them' ? 'Lead' : 'Me'}: ${m.content}`;
        }).join("\n");
        if (context.length > 5000) {
            return NextResponse.json({ error: "Conversation context exceeds allowed size" }, { status: 400 });
        }

        if (!context) {
            return NextResponse.json({ suggestions: ["Hello! How can I help you today?", "Thanks for reaching out.", "Let's schedule a call."] });
        }

        // 2. Get Team ID for credits & memories
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, teamId },
            select: { teamId: true }
        });
        if (!lead?.teamId) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        // 3. Get Memories
        let memories: string[] = [];
        if (lead?.teamId) {
            memories = await LearningService.getMemories(lead.teamId);
        }

        // 4. Generate Suggestions
        const normalizedTone = typeof tone === "string" ? tone.slice(0, 40) : "professional";
        const suggestions = await aiService.generateSmartReply(context, normalizedTone || "professional", memories, teamId);

        return NextResponse.json({ suggestions });

    } catch (error: any) {
        console.error("Error generating suggestions:", error);
        if (error?.message?.includes("Insufficient credits")) {
            return NextResponse.json({ error: error.message }, { status: 402 });
        }
        if (error?.message?.includes("prompt") || error?.message?.includes("not allowed") || error?.message?.includes("exceeds")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
