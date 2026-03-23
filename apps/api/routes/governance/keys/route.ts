import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { randomBytes } from "crypto";

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
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                scopes: true,
                lastUsedAt: true,
                isActive: true,
                createdAt: true,
                // Mask the key: only show first 4 characters
                key: true
            }
        });

        const maskedKeys = keys.map(k => ({
            ...k,
            key: `${k.key.substring(0, 7)}...${k.key.substring(k.key.length - 4)}`
        }));

        return NextResponse.json({ success: true, keys: maskedKeys });
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

        // Generate a cryptographically secure key
        const key = `cs_live_${randomBytes(24).toString('hex')}`;

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
