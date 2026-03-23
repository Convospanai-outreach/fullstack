export enum CapabilityLayer {
    CORE = "CORE",
    GOVERNED_AI = "GOVERNED_AI",
    ADVANCED_OPS = "ADVANCED_OPS",
    EXPERIMENTAL = "EXPERIMENTAL"
}

export enum ProductMode {
    ENTERPRISE_CORE = "ENTERPRISE_CORE",
    GROWTH = "GROWTH",
    ALL_FEATURES = "ALL_FEATURES"
}

export interface FeatureDefinition {
    key: string;
    description: string;
    layer: CapabilityLayer;
    defaultValue: boolean;
}

export const FEATURE_DEFINITIONS: Record<string, FeatureDefinition> = {
    // Core: Basic functionality
    "email_sequences": {
        key: "email_sequences",
        description: "Standard email sequencing",
        layer: CapabilityLayer.CORE,
        defaultValue: true
    },

    // Governed AI: AI features that are safe and governed
    "ai_drafting": {
        key: "ai_drafting",
        description: "AI Draft Generation with human review",
        layer: CapabilityLayer.GOVERNED_AI,
        defaultValue: true
    },

    // Advanced Ops: More powerful, potentially riskier or complex features
    "linkedin_automation": {
        key: "linkedin_automation",
        description: "Automated LinkedIn actions",
        layer: CapabilityLayer.ADVANCED_OPS,
        defaultValue: false
    },

    // Experimental: Cutting edge, potentially unstable
    "autonomous_agents": {
        key: "autonomous_agents",
        description: "Fully autonomous agent loops",
        layer: CapabilityLayer.EXPERIMENTAL,
        defaultValue: false
    }
};
