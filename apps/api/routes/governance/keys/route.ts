import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { audit } from "@/lib/governance/audit";
import {
    ApiKeyValidationError,
    createApiKeySecret,
    createStoredApiKeyValue,
    toApiKeyListMetadata,
    validateApiKeyScopes,
} from "@/lib/apiKeySecurity";

const KEY_LIST_LIMIT = 100;

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
            take: KEY_LIST_LIMIT,
            select: {
                id: true,
                name: true,
                scopes: true,
                lastUsedAt: true,
                isActive: true,
                createdAt: true,
                key: true
            }
        });

        const maskedKeys = keys.map(({ key, ...metadata }) => ({
            ...metadata,
            ...toApiKeyListMetadata(key),
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
        const { userId, teamId } = await getCurrentContext();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });
        if (!teamId) return new NextResponse("Workspace Not Found", { status: 404 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        let body: { name?: string; scopes?: unknown };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ success: false, error: "Malformed JSON" }, { status: 400 });
        }

        const generated = createApiKeySecret();
        let validatedScopes;
        try {
            validatedScopes = validateApiKeyScopes(body.scopes);
        } catch (error) {
            if (error instanceof ApiKeyValidationError) {
                return NextResponse.json({ success: false, error: error.message }, { status: 400 });
            }
            throw error;
        }

        const apiKey = await prisma.apiKey.create({
            data: {
                name: body.name || "New API Key",
                key: createStoredApiKeyValue(generated.secret),
                teamId,
                scopes: validatedScopes
            }
        });

        try {
            await audit({
                actorId: userId,
                orgId: teamId,
                action: "API_KEY_CREATED",
                entity: "ApiKey",
                entityId: apiKey.id,
                metadata: {
                    name: apiKey.name,
                    scopes: apiKey.scopes,
                    keyPrefix: generated.keyPrefix,
                    keyLastFour: generated.keyLastFour,
                    legacy: false,
                }
            });
        } catch (error) {
            logger.error("[Governance API] Failed to audit API key creation", {
                error: error instanceof Error ? error.message : "Unknown error",
                keyId: apiKey.id,
                keyLastFour: generated.keyLastFour,
            });
        }

        return NextResponse.json({
            success: true,
            key: {
                id: apiKey.id,
                name: apiKey.name,
                scopes: apiKey.scopes,
                lastUsedAt: apiKey.lastUsedAt,
                isActive: apiKey.isActive,
                createdAt: apiKey.createdAt,
                keyPrefix: generated.keyPrefix,
                keyLastFour: generated.keyLastFour,
                displayKey: `${generated.keyPrefix}...${generated.keyLastFour}`,
                legacy: false,
                secret: generated.secret,
            }
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Governance API] Failed to create API key", { error: errorMessage });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
