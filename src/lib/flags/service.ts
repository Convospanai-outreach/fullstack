import { prisma } from "@/lib/db";
import { FEATURE_DEFINITIONS, CapabilityLayer, ProductMode } from "./config";

export class FeatureFlagService {
    /**
     * Checks if a feature is enabled for a specific team.
     * 
     * Evaluation Logic:
     * 1. Check if the feature exists in definitions.
     * 2. Check the team's ProductMode (Enterprise Core, Growth, etc.).
     * 3. Check specific FeatureFlag overrides in DB.
     * 
     * Rule:
     * - If ProductMode is ENTERPRISE_CORE, only CORE and GOVERNED_AI layers are allowed.
     * - EXPERIMENTAL is blocked unless mode is ALL_FEATURES.
     */
    static async isEnabled(featureKey: string, teamId: string): Promise<boolean> {
        const definition = FEATURE_DEFINITIONS[featureKey];
        if (!definition) {
            console.warn(`Feature flag ${featureKey} not defined`);
            return false;
        }

        // 1. Fetch Team Policy
        const policy = await prisma.organizationPolicy.findUnique({
            where: { teamId }
        });

        const mode = policy?.productMode || ProductMode.ENTERPRISE_CORE; // Default to safest mode

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
