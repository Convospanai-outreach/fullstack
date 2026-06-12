/**
 * Frontend-safe mirrors of Prisma enums.
 * These MUST match the values in apps/web/prisma/schema.prisma exactly.
 * Do NOT import from @prisma/client in React components — use these instead.
 */

export enum Region {
    GLOBAL = "GLOBAL",
    UAE = "UAE",
    EU = "EU"
}

export enum ConversationState {
    INITIATED = "INITIATED",
    ENGAGED = "ENGAGED",
    QUALIFIED = "QUALIFIED",
    HANDOFF_REQUIRED = "HANDOFF_REQUIRED",
    COORDINATING = "COORDINATING",
    MEETING_CONFIRMED = "MEETING_CONFIRMED",
    CLOSED = "CLOSED"
}

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

export const UserRole = {
    SUPER_ADMIN: "SUPER_ADMIN",
    SYSTEM_ADMIN: "SYSTEM_ADMIN",
    ORG_ADMIN: "ORG_ADMIN",
    CMS_EDITOR: "CMS_EDITOR",
    SALES_MANAGER: "SALES_MANAGER",
    SALES_USER: "SALES_USER",
    CALLER: "CALLER",
    VIEWER: "VIEWER",
    COMPLIANCE_OFFICER: "COMPLIANCE_OFFICER"
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export enum TrainingTaskType {
    TONE_NORMALIZATION = "TONE_NORMALIZATION",
    GRAMMAR_REPAIR = "GRAMMAR_REPAIR",
    BRAND_ENFORCEMENT = "BRAND_ENFORCEMENT",
    POLICY_CLASSIFICATION = "POLICY_CLASSIFICATION",
    POLICY_REWRITE = "POLICY_REWRITE",
    CONVERSATION_SUMMARY = "CONVERSATION_SUMMARY",
    OBJECTION_EXTRACTION = "OBJECTION_EXTRACTION",
    REFUSAL_GENERATION = "REFUSAL_GENERATION"
}

export enum DatasetStatus {
    DRAFT = "DRAFT",
    IN_REVIEW = "IN_REVIEW",
    REVIEWED = "REVIEWED",
    TRAINING = "TRAINING",
    DEPLOYED = "DEPLOYED"
}

export enum ModelStatus {
    TRAINING = "TRAINING",
    VALIDATION = "VALIDATION",
    DEPLOYED = "DEPLOYED",
    ROLLED_BACK = "ROLLED_BACK"
}

// Placeholder structural types for complex Prisma models used as props
export type ConversationThread = {
    id: string;
    leadId: string;
    state: ConversationState;
    [key: string]: any;
};

export type Job = {
    id: string;
    type: string;
    status: string;
    [key: string]: any;
};
