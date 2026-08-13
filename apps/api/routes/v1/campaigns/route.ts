import { NextRequest, NextResponse } from "next/server";
import { authorizeApiKey } from "@/lib/apiAuth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const authResult = await authorizeApiKey(req, "campaigns:read");
    if (!authResult.ok) return authResult.response;
    const auth = authResult.context;

    const rateLimit = await import("@/lib/apiRateLimit").then(m => m.checkApiRateLimit(auth.teamId));
    if (!rateLimit.success) {
        return (await import("@/lib/apiRateLimit")).rateLimitResponse(rateLimit.resetIn!);
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = { teamId: auth.teamId };
    if (status) {
        where.status = status;
    }

    const campaigns = await prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            variants: {
                select: {
                    id: true,
                    subject: true,
                    weight: true,
                    sentCount: true,
                    openCount: true,
                    replyCount: true
                }
            },
            _count: {
                select: { leadList: true, emails: true }
            }
        }
    });

    return NextResponse.json({ data: campaigns });
}
