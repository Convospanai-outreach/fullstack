import { NextResponse } from "next/server";
import { CapabilityLayer as DbCapabilityLayer, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { checkAdmin } from "@/lib/admin";
import { FEATURE_DEFINITIONS } from "@/lib/flags/config";

async function requireSuperAdmin() {
    if (!(await checkAdmin(UserRole.SYSTEM_ADMIN))) {
        throw new APIError("Forbidden: Super admin access required", 403, "FORBIDDEN");
    }
}

async function listFlags() {
    const keys = Object.keys(FEATURE_DEFINITIONS);
    const overrides = await prisma.featureFlag.findMany({ where: { key: { in: keys } }, select: { key: true, isEnabled: true, updatedAt: true } });
    const byKey = new Map(overrides.map((row) => [row.key, row]));
    return keys.map((key) => {
        const definition = FEATURE_DEFINITIONS[key]!;
        const override = byKey.get(key);
        return {
            key,
            description: definition.description,
            layer: definition.layer,
            defaultValue: definition.defaultValue,
            override: override ? override.isEnabled : null,
            updatedAt: override?.updatedAt ?? null,
        };
    });
}

// Platform feature flags (lib/flags/config.ts) with their global DB overrides.
// A team's product mode can still keep a flag off for that team.
export async function GET() {
    try {
        await requireSuperAdmin();
        return NextResponse.json({ flags: await listFlags() });
    } catch (error) {
        return handleAPIError(error);
    }
}

// { key, enabled: true | false } sets a global override; enabled: null removes it
// so the flag goes back to its default.
export async function POST(req: Request) {
    try {
        await requireSuperAdmin();
        const body = (await req.json().catch(() => null)) as { key?: unknown; enabled?: unknown } | null;
        const key = typeof body?.key === "string" ? body.key : "";
        const definition = FEATURE_DEFINITIONS[key];
        if (!definition) throw new APIError("Unknown feature flag", 400, "VALIDATION_ERROR");
        if (body?.enabled !== null && typeof body?.enabled !== "boolean") {
            throw new APIError("enabled must be true, false or null", 400, "VALIDATION_ERROR");
        }

        if (body.enabled === null) {
            await prisma.featureFlag.deleteMany({ where: { key } });
        } else {
            await prisma.featureFlag.upsert({
                where: { key },
                create: { key, isEnabled: body.enabled, layer: definition.layer as unknown as DbCapabilityLayer, description: definition.description },
                update: { isEnabled: body.enabled },
            });
        }
        return NextResponse.json({ flags: await listFlags() });
    } catch (error) {
        return handleAPIError(error);
    }
}
