import { NextRequest, NextResponse } from "next/server";
import { InboxAgent, ThreadContext } from "@/lib/ai/agents/InboxAgent";
import { getCurrentContext } from "@/lib/auth";
import { aiLimiter } from "@/lib/rate-limit";
import { z } from "zod";
import { prisma } from "@/lib/db";

const inboxSchema = z.object({
    messages: z.array(z.object({
        role: z.string(),
        content: z.string()
    })).min(1),
    leadId: z.string().optional()
});

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { isRateLimited } = aiLimiter.check(10, ctx.userId); // Higher limit for chat
        if (isRateLimited) {
            return NextResponse.json({ error: "Rate limit exceeded. Please wait a minute." }, { status: 429 });
        }

        const body = await req.json();
        const validation = inboxSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
        }

        const { messages, leadId } = validation.data;

        const agent = new InboxAgent();
        const context: ThreadContext = { messages };
        const analysis = await agent.analyzeThread(context);

        let lead = null;
        if (leadId) {
            const record = await prisma.lead.findFirst({
                where: { id: leadId, teamId: ctx.teamId },
                select: {
                    fullName: true,
                    jobTitle: true,
                    company: true,
                    location: true,
                    value: true
                }
            });
            if (record) {
                lead = {
                    name: record.fullName || "Unknown",
                    role: record.jobTitle || "Unknown",
                    company: record.company || "Unknown",
                    location: record.location || "Unknown",
                    size: "N/A",
                    revenue: record.value ? `$${record.value}` : "N/A"
                };
            }
        }

        return NextResponse.json({
            ...analysis,
            ...(lead ? { lead } : {})
        });
    } catch (error: any) {
        console.error("Inbox Agent Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
