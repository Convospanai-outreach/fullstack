import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { audit } from "@/lib/governance/audit";
import {
    ApiKeyValidationError,
    createApiKeySecret,
    createStoredApiKeyValue,
    toApiKeyListMetadata,
    validateApiKeyScopes,
} from "@/lib/apiKeySecurity";

const KEY_LIST_LIMIT = 100;

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(ctx.userId, ctx.teamId, TeamRole.ADMIN);

    const keys = await prisma.apiKey.findMany({
        where: { teamId: ctx.teamId, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: KEY_LIST_LIMIT,
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

    let body: { name?: string; scopes?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
    }

    let validatedScopes;
    try {
        validatedScopes = validateApiKeyScopes(body.scopes);
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
            name: body.name || "Untitled Key",
            key: createStoredApiKeyValue(generated.secret),
            scopes: validatedScopes
        }
    });

    try {
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
    } catch (error) {
        logger.error("[Settings API] Failed to audit API key creation", {
            error: error instanceof Error ? error.message : "Unknown error",
            keyId: key.id,
            keyLastFour: generated.keyLastFour,
        });
    }

    return NextResponse.json({
        id: key.id,
        name: key.name,
        scopes: key.scopes,
        lastUsedAt: key.lastUsedAt,
        isActive: key.isActive,
        createdAt: key.createdAt,
        keyPrefix: generated.keyPrefix,
        keyLastFour: generated.keyLastFour,
        displayKey: `${generated.keyPrefix}...${generated.keyLastFour}`,
        legacy: false,
        secret: generated.secret,
    });
}
