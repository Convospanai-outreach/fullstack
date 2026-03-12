import { NextRequest, NextResponse } from "next/server";
import { CampaignAgent } from "@/lib/ai/agents/CampaignAgent";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { aiLimiter } from "@/lib/rate-limit";
import { z } from "zod";

const campaignSchema = z.object({
    goal: z.string().min(5),
    targetAudience: z.string().min(2),
    tone: z.string().default("professional")
});

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { isRateLimited } = aiLimiter.check(5, session.user.email);
        if (isRateLimited) {
            return NextResponse.json({ error: "Rate limit exceeded. Please wait a minute." }, { status: 429 });
        }

        const body = await req.json();
        const validation = campaignSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
        }

        const { goal, targetAudience, tone } = validation.data;
        const input = { goal, audience: targetAudience, tone };

        const agent = new CampaignAgent();
        const result = await agent.generateSequence(input);

        return NextResponse.json({ sequence: result });
    } catch (error: any) {
        console.error("Campaign Agent Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
