import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { audit } from "@/lib/governance/audit";
import {
    ApiKeyValidationError,
    createApiKeySecret,
    createStoredApiKeyValue,
    toApiKeyListMetadata,
    validateApiKeyScopes,
} from "@/lib/apiKeySecurity";

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
            isActive: true,
            key: true
        }
    });

    return NextResponse.json(keys.map(({ key, ...metadata }) => ({
        ...metadata,
        ...toApiKeyListMetadata(key),
    })));
}

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(ctx.userId, ctx.teamId, TeamRole.ADMIN);

    const { name, scopes } = await req.json();
    let validatedScopes;
    try {
        validatedScopes = validateApiKeyScopes(scopes);
    } catch (error) {
        if (error instanceof ApiKeyValidationError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }

    const generated = createApiKeySecret();

    const key = await prisma.apiKey.create({
        data: {
            teamId: ctx.teamId,
            name: name || "Untitled Key",
            key: createStoredApiKeyValue(generated.secret),
            scopes: validatedScopes
        }
    });

    await audit({
        actorId: ctx.userId,
        orgId: ctx.teamId,
        action: "API_KEY_CREATED",
        entity: "ApiKey",
        entityId: key.id,
        metadata: {
            name: key.name,
            scopes: key.scopes,
            keyPrefix: generated.keyPrefix,
            keyLastFour: generated.keyLastFour,
            legacy: false,
        }
    });

    return NextResponse.json({
        id: key.id,
        name: key.name,
        scopes: key.scopes,
        lastUsedAt: key.lastUsedAt,
        isActive: key.isActive,
        createdAt: key.createdAt,
        keyPrefix: generated.keyPrefix,
        keyLastFour: generated.keyLastFour,
        legacy: false,
        key: generated.secret,
    });
}
