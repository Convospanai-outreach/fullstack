import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { UserRole } from "@prisma/client";

const isAdminUser = (user: { role?: string | null; enterpriseRole?: UserRole | null } | null) => {
    if (!user) return false;
    const legacyAdmin = user.role === "admin" || user.role === "superadmin";
    const enterpriseAdmin =
        user.enterpriseRole === UserRole.SYSTEM_ADMIN ||
        user.enterpriseRole === UserRole.ORG_ADMIN;
    return legacyAdmin || enterpriseAdmin;
};

const maskKey = (value?: string | null) => {
    if (!value) return null;
    if (value.length <= 8) return "****";
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, enterpriseRole: true }
        });
        if (!isAdminUser(currentUser)) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { aiConfig: true }
        });

        const providers = (team?.aiConfig as any)?.providers || {};

        return NextResponse.json({
            teamId,
            providers: {
                gemini: {
                    apiKey: maskKey(providers?.gemini?.apiKey),
                    model: providers?.gemini?.model || "gemini-1.5-pro"
                },
                openai: {
                    apiKey: maskKey(providers?.openai?.apiKey),
                    model: providers?.openai?.model || "gpt-4o-mini"
                },
                anthropic: {
                    apiKey: maskKey(providers?.anthropic?.apiKey),
                    model: providers?.anthropic?.model || "claude-3-5-sonnet"
                }
            }
        });
    } catch (error: any) {
        return handleAPIError(error);
    }
}

export async function POST(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, enterpriseRole: true }
        });
        if (!isAdminUser(currentUser)) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const body = await req.json();
        const {
            geminiApiKey,
            geminiModel,
            openaiApiKey,
            openaiModel,
            anthropicApiKey,
            anthropicModel
        } = body || {};

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { aiConfig: true }
        });

        const currentConfig = (team?.aiConfig as any) || {};
        const providers = currentConfig.providers || {};

        const nextProviders = {
            gemini: {
                ...providers.gemini,
                apiKey: typeof geminiApiKey === "string" ? geminiApiKey.trim() || null : providers.gemini?.apiKey,
                model: typeof geminiModel === "string" ? geminiModel.trim() || providers.gemini?.model : providers.gemini?.model
            },
            openai: {
                ...providers.openai,
                apiKey: typeof openaiApiKey === "string" ? openaiApiKey.trim() || null : providers.openai?.apiKey,
                model: typeof openaiModel === "string" ? openaiModel.trim() || providers.openai?.model : providers.openai?.model
            },
            anthropic: {
                ...providers.anthropic,
                apiKey: typeof anthropicApiKey === "string" ? anthropicApiKey.trim() || null : providers.anthropic?.apiKey,
                model: typeof anthropicModel === "string" ? anthropicModel.trim() || providers.anthropic?.model : providers.anthropic?.model
            }
        };

        const updated = await prisma.team.update({
            where: { id: teamId },
            data: {
                aiConfig: {
                    ...currentConfig,
                    providers: nextProviders
                }
            },
            select: { aiConfig: true }
        });

        return NextResponse.json({
            teamId,
            providers: {
                gemini: {
                    apiKey: maskKey(nextProviders.gemini?.apiKey),
                    model: nextProviders.gemini?.model || "gemini-1.5-pro"
                },
                openai: {
                    apiKey: maskKey(nextProviders.openai?.apiKey),
                    model: nextProviders.openai?.model || "gpt-4o-mini"
                },
                anthropic: {
                    apiKey: maskKey(nextProviders.anthropic?.apiKey),
                    model: nextProviders.anthropic?.model || "claude-3-5-sonnet"
                }
            }
        });
    } catch (error: any) {
        return handleAPIError(error);
    }
}
