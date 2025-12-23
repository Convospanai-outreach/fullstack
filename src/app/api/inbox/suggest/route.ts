import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { InboxService } from "@/lib/inboxService";
import { AIService } from "@/lib/aiService";
import { prisma } from "@/lib/db";
import { LearningService } from "@/modules/learning/learningService";

export async function POST(req: NextRequest) {
    try {
        const { userId } = await getCurrentContext();
        if (!userId) {
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

        if (!context) {
            return NextResponse.json({ suggestions: ["Hello! How can I help you today?", "Thanks for reaching out.", "Let's schedule a call."] });
        }

        // 2. Get Team ID for credits & memories
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { teamId: true }
        });

        // 3. Get Memories
        let memories: string[] = [];
        if (lead?.teamId) {
            memories = await LearningService.getMemories(lead.teamId);
        }

        // 4. Generate Suggestions
        const suggestions = await AIService.generateSmartReply(context, tone || "professional", memories);

        return NextResponse.json({ suggestions });

    } catch (error: any) {
        console.error("Error generating suggestions:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
