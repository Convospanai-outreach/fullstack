import { NextResponse } from "next/server";
import { InboxService } from "@/lib/inboxService";
import { aiService } from "@/lib/aiService";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const messages = await InboxService.getMessages(id);

        if (!messages || messages.length === 0) {
            return NextResponse.json({ suggestions: [] });
        }

        // Format context for AI
        // Take last 10 messages to avoid huge context
        const recentMessages = messages.slice(-10);
        const context = recentMessages.map(m =>
            `${m.sender === "me" ? "Me" : "Lead"}: ${m.content}`
        ).join("\n");

        const suggestions = await aiService.generateSmartReply(context);

        return NextResponse.json({ suggestions });
    } catch (error: any) {
        console.error("Failed to generate suggestions:", error);
        return NextResponse.json(
            { error: "Failed to generate suggestions" },
            { status: 500 }
        );
    }
}
