import { NextRequest, NextResponse } from "next/server";
import { ICPAgent } from "@/lib/ai/agents/ICPAgent";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { aiLimiter } from "@/lib/rate-limit";
import { z } from "zod";

const icpSchema = z.object({
    industry: z.string().min(2),
    role: z.string().min(2),
    size: z.string().optional(),
    painPoints: z.string().min(5)
});

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { isRateLimited } = aiLimiter.check(5, session.user.email); // 5 requests per minute
        if (isRateLimited) {
            return NextResponse.json({ error: "Rate limit exceeded. Please wait a minute." }, { status: 429 });
        }

        const body = await req.json();
        const validation = icpSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid input", details: validation.error.format() }, { status: 400 });
        }

        const { industry, role, size, painPoints } = validation.data;

        const input = {
            industry,
            role,
            size: size || "Unknown",
            painPoints
        };

        const agent = new ICPAgent();
        const result = await agent.generate(input);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("ICP Agent Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
