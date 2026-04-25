import { NextResponse } from "next/server";
import { InboxService } from "@/lib/inboxService";
import { aiService } from "@/lib/aiService";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const lead = await prisma.lead.findFirst({
            where: { id, teamId },
            select: { id: true }
        });
        if (!lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

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
        if (context.length > 5000) {
            return NextResponse.json({ error: "Conversation context exceeds allowed size" }, { status: 400 });
        }

        const suggestions = await aiService.generateSmartReply(context, "professional", [], teamId);

        return NextResponse.json({ suggestions });
    } catch (error: any) {
        console.error("Failed to generate suggestions:", error);
        if (error?.message?.includes("Insufficient credits")) {
            return NextResponse.json({ error: error.message }, { status: 402 });
        }
        if (error?.message?.includes("prompt") || error?.message?.includes("not allowed") || error?.message?.includes("exceeds")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json(
            { error: "Failed to generate suggestions" },
            { status: 500 }
        );
    }
}
