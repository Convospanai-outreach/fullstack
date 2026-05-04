import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { randomBytes } from "crypto";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });
        if (!teamId) return new NextResponse("Workspace Not Found", { status: 404 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            return new NextResponse("Forbidden", { status: 403 });
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
    try {
        const { name } = await req.json();
        const { userId, teamId } = await getCurrentContext();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });
        if (!teamId) return new NextResponse("Workspace Not Found", { status: 404 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            return new NextResponse("Forbidden", { status: 403 });
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
