import { HIDDEN_FEATURES, type HiddenFeatureKey } from "@/lib/productFlags";

// Platform-wide off switches for hidden features, set from the superadmin panel.
// Stored as global FeatureFlag rows "hidden_feature:<key>" with isEnabled=false; a
// feature switched off here is off for every team whatever the team chose.
export const HIDDEN_FEATURE_FLAG_PREFIX = "hidden_feature:";

export async function loadPlatformDisabledFeatures(): Promise<Set<HiddenFeatureKey>> {
    const { prisma } = await import("@/lib/db");
    const rows = await prisma.featureFlag.findMany({
        where: { key: { startsWith: HIDDEN_FEATURE_FLAG_PREFIX }, isEnabled: false },
        select: { key: true },
    });
    return new Set(
        rows
            .map((row) => row.key.slice(HIDDEN_FEATURE_FLAG_PREFIX.length))
            .filter((key): key is HiddenFeatureKey => key in HIDDEN_FEATURES)
    );
}
