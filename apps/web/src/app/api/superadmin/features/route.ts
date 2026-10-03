import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";
import { HIDDEN_FEATURE_FLAG_PREFIX, loadPlatformDisabledFeatures } from "@/lib/hiddenFeatureSwitches";
import { HIDDEN_FEATURES, type HiddenFeatureKey } from "@/lib/productFlags";

async function listFeatures() {
    const disabled = await loadPlatformDisabledFeatures();
    return Object.values(HIDDEN_FEATURES).map((feature) => ({
        key: feature.key,
        label: feature.label,
        description: feature.description,
        disabledByPlatform: disabled.has(feature.key),
    }));
}

// Platform-wide off switches for the optional (hidden) features.
export async function GET() {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    return NextResponse.json({ features: await listFeatures() });
}

// { key, disabled: true } turns the feature off for every team; false lifts it.
export async function POST(req: NextRequest) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const input = (await req.json().catch(() => null)) as { key?: unknown; disabled?: unknown } | null;
    if (typeof input?.key !== "string" || !(input.key in HIDDEN_FEATURES) || typeof input.disabled !== "boolean") {
        return NextResponse.json({ error: "A known feature key and disabled (true or false) are required" }, { status: 400 });
    }
    const key = input.key as HiddenFeatureKey;
    const flagKey = `${HIDDEN_FEATURE_FLAG_PREFIX}${key}`;
    const { prisma } = await import("@/lib/db");
    if (input.disabled) {
        await prisma.featureFlag.upsert({
            where: { key: flagKey },
            create: { key: flagKey, isEnabled: false, description: `Platform switch for the ${key} feature, set from the superadmin panel` },
            update: { isEnabled: false },
        });
    } else {
        await prisma.featureFlag.deleteMany({ where: { key: flagKey } });
    }
    await auditSuperAdmin(actor, input.disabled ? "FEATURE_PLATFORM_OFF" : "FEATURE_PLATFORM_ON", req, { key });
    return NextResponse.json({ features: await listFeatures() });
}
