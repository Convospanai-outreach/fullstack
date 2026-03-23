import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function validateApiKey(req: NextRequest, requiredScope?: string) {
    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
        return null;
    }

    const keyRecord = await prisma.apiKey.findUnique({
        where: { key: apiKey }
    });

    if (!keyRecord || !keyRecord.isActive) {
        return null;
    }

    if (requiredScope && !keyRecord.scopes.includes(requiredScope) && !keyRecord.scopes.includes("admin")) {
        return null; // Missing scope
    }

    // Async update last used (non-blocking)
    prisma.apiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() }
    }).catch(console.error);

    return {
        teamId: keyRecord.teamId,
        scopes: keyRecord.scopes
    };
}
