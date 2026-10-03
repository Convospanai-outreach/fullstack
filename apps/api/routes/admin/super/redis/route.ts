import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { checkAdmin } from "@/lib/admin";
import { applyRedisSwitch, getRedisClient, getRedisStatus, REDIS_SWITCH_KEY } from "@/lib/redis";

async function requireSuperAdmin() {
    const isSuperAdmin = await checkAdmin(UserRole.SYSTEM_ADMIN);
    if (!isSuperAdmin) {
        throw new APIError("Forbidden: Super admin access required", 403, "FORBIDDEN");
    }
}

// Redis status as this API process sees it (booleans and state only - never the URL).
export async function GET() {
    try {
        await requireSuperAdmin();
        await getRedisClient();
        return NextResponse.json(getRedisStatus());
    } catch (error) {
        return handleAPIError(error);
    }
}

// Turns Redis use on or off for every API process. Turning it on only connects
// when the server has a Redis URL configured; the URL is set outside the panel.
export async function POST(req: Request) {
    try {
        await requireSuperAdmin();
        const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
        if (typeof body?.enabled !== "boolean") {
            throw new APIError("enabled must be true or false", 400, "VALIDATION_ERROR");
        }

        await prisma.featureFlag.upsert({
            where: { key: REDIS_SWITCH_KEY },
            create: { key: REDIS_SWITCH_KEY, isEnabled: body.enabled, description: "Redis on/off, set from the superadmin panel" },
            update: { isEnabled: body.enabled },
        });
        return NextResponse.json(await applyRedisSwitch(body.enabled));
    } catch (error) {
        return handleAPIError(error);
    }
}
