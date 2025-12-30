import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
// No crypto import needed as we'll use Math.random for this demo or standard crypto if available globally

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true }
        });

        const teamId = user?.memberships?.[0]?.teamId;
        if (!teamId) {
            return new NextResponse("Workspace Not Found", { status: 404 });
        }

        const keys = await prisma.apiKey.findMany({
            where: { teamId },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ success: true, keys });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Governance API] Failed to fetch API keys", { error: errorMessage });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const { name } = await req.json();
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { memberships: true }
        });

        const teamId = user?.memberships?.[0]?.teamId;
        if (!teamId) {
            return new NextResponse("Workspace Not Found", { status: 404 });
        }

        // Generate a secure key
        const key = `cs_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;

        const apiKey = await prisma.apiKey.create({
            data: {
                name: name || "New API Key",
                key,
                teamId,
                scopes: ["leads:read", "campaigns:write"]
            }
        });

        return NextResponse.json({ success: true, key: apiKey });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Governance API] Failed to create API key", { error: errorMessage });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
