import { NextRequest, NextResponse } from "next/server";
import { InboxAgent, ThreadContext } from "@/lib/ai/agents/InboxAgent";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { aiLimiter } from "@/lib/rate-limit";
import { z } from "zod";

const inboxSchema = z.object({
    messages: z.array(z.object({
        role: z.string(),
        content: z.string()
    })).min(1)
});

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { isRateLimited } = aiLimiter.check(10, session.user.email); // Higher limit for chat
        if (isRateLimited) {
            return NextResponse.json({ error: "Rate limit exceeded. Please wait a minute." }, { status: 429 });
        }

        const body = await req.json();
        const validation = inboxSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
        }

        const { messages } = validation.data;

        const agent = new InboxAgent();
        const context: ThreadContext = { messages };
        const analysis = await agent.analyzeThread(context);

        // Mock CRM Data (In a real app, we'd fetch this from HubSpot/Salesforce)
        const enrichedResult = {
            ...analysis,
            lead: {
                name: "Sarah Miller",
                role: "VP of Operations",
                company: "TechFlow Inc.",
                location: "San Francisco, CA",
                size: "50-200",
                revenue: "$10M - $50M"
            }
        };

        return NextResponse.json(enrichedResult);
    } catch (error: any) {
        console.error("Inbox Agent Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
