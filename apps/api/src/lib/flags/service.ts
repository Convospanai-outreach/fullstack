import { prisma } from "@/lib/db";
import { FEATURE_DEFINITIONS, CapabilityLayer, ProductMode } from "./config";
import { safeGet, safeSet } from "@/lib/redis";

export class FeatureFlagService {
    /**
     * Checks if a feature is enabled for a specific team.
     * Evaluates definitions, ProductMode, and DB overrides with Redis caching.
     */
    static async isEnabled(featureKey: string, teamId: string): Promise<boolean> {
        const cacheKey = `ff:${teamId}:${featureKey}`;
        
        // [Performance] Check cache first
        const cached = await safeGet(cacheKey);
        if (cached !== null) {
            return cached === "true";
        }

        const isEnabled = await this.resolveEnabled(featureKey, teamId);
        
        // [Performance] Store in cache for 5 minutes
        await safeSet(cacheKey, isEnabled.toString(), 300);

        return isEnabled;
    }

    private static async resolveEnabled(featureKey: string, teamId: string): Promise<boolean> {
        const definition = FEATURE_DEFINITIONS[featureKey];
        if (!definition) {
            console.warn(`Feature flag ${featureKey} not defined`);
            return false;
        }

        // linkedin_automation is enabled by default for every team, product
        // surface, and product mode (2026-08-20 decision, see OPEN_ITEMS.md
        // OPEN-54) — bypasses the productSurface/ProductMode gating below,
        // which still applies to every other flag. DB override still wins.
        if (featureKey === "linkedin_automation") {
            const flagOverride = await prisma.featureFlag.findUnique({ where: { key: featureKey } });
            if (flagOverride !== null && flagOverride !== undefined) {
                return flagOverride.isEnabled;
            }
            return definition.defaultValue;
        }

        // 1. Fetch Team Policy
        const policy = await prisma.organizationPolicy.findUnique({
            where: { organizationId: teamId }
        });

        const mode = (policy?.productMode as ProductMode) || ProductMode.ENTERPRISE_CORE; // Default to safest mode
        const productSurface = policy?.productSurface || "outreach";

        const runtimeOnlyFeatures = new Set([
            "autonomous_agents"
        ]);
        if (productSurface !== "runtime" && runtimeOnlyFeatures.has(featureKey)) {
            return false;
        }

        // 2. Layer Restriction based on Mode
        if (!this.isLayerAllowedInMode(definition.layer, mode)) {
            return false;
        }

        // 3. DB Override (Dynamic Toggle)
        // If the layer is allowed, we check if it is explicitly enabled/disabled in DB
        // If no DB record, fallback to definition default
        const flagOverride = await prisma.featureFlag.findUnique({
            where: { key: featureKey }
        });

        if (flagOverride !== null && flagOverride !== undefined) {
            return flagOverride.isEnabled;
        }

        return definition.defaultValue;
    }

    private static isLayerAllowedInMode(layer: CapabilityLayer, mode: ProductMode): boolean {
        switch (mode) {
            case ProductMode.ENTERPRISE_CORE:
                return layer === CapabilityLayer.CORE || layer === CapabilityLayer.GOVERNED_AI;

            case ProductMode.GROWTH:
                return layer !== CapabilityLayer.EXPERIMENTAL;

            case ProductMode.ALL_FEATURES:
                return true;

            default:
                return false;
        }
    }
}
