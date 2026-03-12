import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: { include: { team: { include: { guardrailPolicy: true } } } } }
        });

        const team = user?.memberships?.[0]?.team;
        if (!team) {
            return new NextResponse("Workspace Not Found", { status: 404 });
        }

        let policy = team.guardrailPolicy;

        // Initialize if doesn't exist
        if (!policy) {
            policy = await prisma.guardrailPolicy.create({
                data: {
                    teamId: team.id,
                    blocklist: ["spam", "buy now", "winning"],
                    allowlist: [],
                    regexRules: [],
                    competitorMentions: [],
                }
            });
        }

        return NextResponse.json({ success: true, policy });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Governance API] Failed to fetch guardrails", { error: errorMessage });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const body = await req.json();
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true }
        });

        const teamId = user?.memberships?.[0]?.teamId;
        if (!teamId) {
            return new NextResponse("Workspace Not Found", { status: 404 });
        }

        const policy = await prisma.guardrailPolicy.upsert({
            where: { teamId },
            create: {
                teamId,
                ...body
            },
            update: body
        });

        return NextResponse.json({ success: true, policy });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Governance API] Failed to update guardrails", { error: errorMessage });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
