import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { audit } from "@/lib/governance/audit";

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(ctx.userId, ctx.teamId, TeamRole.ADMIN);

    const keys = await prisma.apiKey.findMany({
        where: { teamId: ctx.teamId, isActive: true },
        select: {
            id: true,
            name: true,
            scopes: true,
            lastUsedAt: true,
            createdAt: true,
            key: false // Do not return full key
        }
    });

    // We can return a hint like "sk_...1234" if we stored it, but for now just metadata
    return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(ctx.userId, ctx.teamId, TeamRole.ADMIN);

    const { name, scopes } = await req.json();

    // Generate random key
    const rawKey = "sk_live_" + randomBytes(24).toString("hex");

    const key = await prisma.apiKey.create({
        data: {
            teamId: ctx.teamId,
            name: name || "Untitled Key",
            key: rawKey,
            scopes: scopes || ["leads:read", "campaigns:read"]
        }
    });

    await audit({
        actorId: ctx.userId,
        orgId: ctx.teamId,
        action: "API_KEY_CREATED",
        entity: "ApiKey",
        entityId: key.id,
        metadata: { name: key.name, scopes: key.scopes }
    });

    return NextResponse.json({ ...key, key: rawKey }); // Return full key ONCE
}
