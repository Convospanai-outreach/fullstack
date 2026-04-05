import { z } from "zod";

// Common validation schemas
export const emailSchema = z.string().email("Invalid email address");
export const idSchema = z.string().uuid("Invalid ID format");
export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20)
});

// --- Enums Matching Prisma ---
export const LeadStatusEnum = z.enum(["NEW", "CONTACTED", "REPLIED", "CONVERTED", "LOST", "STOPPED", "enriched"]);
export const PipelineStateEnum = z.enum(["COLD", "WARM", "HOT", "COORDINATING", "MEETING_CONFIRMED", "COMPLETED"]).default("COLD");
export const TaskStatusEnum = z.enum(["TODO", "DONE"]);
export const TaskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const CampaignStatusEnum = z.enum(["draft", "active", "paused", "completed"]);
export const CampaignTypeEnum = z.enum(["standard", "smart"]);

// --- Campaign Validation ---
export const createCampaignSchema = z.object({
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().max(1000).optional(),
    audience: z.string().max(500).optional(),
    status: CampaignStatusEnum.default("draft"),
    type: CampaignTypeEnum.default("standard"),
    // Advanced fields
    scheduledStart: z.string().datetime().optional().nullable(),
    aiConfig: z.object({
        tone: z.string().optional(),
        voice: z.string().optional(),
        formulation: z.string().optional(),
        goal: z.string().optional(),
        context: z.string().optional(),
        executionMode: z.enum(["saferun", "hybrid", "autonomous"]).default("saferun")
    }).optional().nullable(),
    targetCount: z.number().int().nonnegative().optional().default(0)
});

export const updateCampaignSchema = createCampaignSchema.partial();

// --- Lead Validation ---
export const createLeadSchema = z.object({
    fullName: z.string().min(1, "Full name is required").max(200).optional().nullable(),
    email: emailSchema.optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    company: z.string().max(200).optional().nullable(),
    jobTitle: z.string().max(200).optional().nullable(),
    linkedIn: z.string().max(500).optional().nullable(),
    location: z.string().max(200).optional().nullable(),

    // Status & Tags
    status: LeadStatusEnum.default("NEW"),
    pipelineState: PipelineStateEnum,
    tags: z.array(z.string()).optional(),

    // CRM
    crmId: z.string().optional().nullable(),

    // Value
    value: z.number().optional().default(0.0),

    // Relations
    campaignId: idSchema.optional().nullable(),
    teamId: idSchema.optional(),

    // WhatsApp
    whatsappConsent: z.boolean().default(false),
    whatsappNumber: z.string().optional().nullable(),

    // Meeting Preferences
    preferredMeetingType: z.string().optional().nullable(),
    meetingLocation: z.string().optional().nullable(),

    // Analytics & Scoring
    intentScore: z.number().optional().default(0.0),
    leadScore: z.number().int().optional().default(0),
    dwellTimeMinutes: z.number().optional().default(0.0),
    emailClicks: z.number().int().optional().default(0),
    socialMentions: z.number().int().optional().default(0),
    churnRisk: z.number().optional(),
    optimalSendHour: z.number().int().optional(),
    clusterLabel: z.string().optional().nullable(),

    // Timestamps
    pipelineStateChangedAt: z.string().datetime().optional().nullable(),
    hotAt: z.string().datetime().optional().nullable(),
    lastScoredAt: z.string().datetime().optional().nullable(),
    crmSyncedAt: z.string().datetime().optional().nullable(),

    // Compliance
    consentObtained: z.boolean().default(false)
});

export const updateLeadSchema = createLeadSchema.partial();

// --- Task Validation ---
export const createTaskSchema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    status: TaskStatusEnum.default("TODO"),
    priority: TaskPriorityEnum.default("MEDIUM"),
    leadId: idSchema.optional().nullable(),
    userId: idSchema // Assuming the API might assign it, or it comes from context
});

export const updateTaskSchema = createTaskSchema.partial();

// --- Workflow Validation ---
export const createWorkflowSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(),
    triggerType: z.enum(["MANUAL", "EVENT"]).default("MANUAL"),
    triggerConfig: z.record(z.string(), z.any()).optional().nullable(),
    nodes: z.array(z.record(z.string(), z.any())), // Simplification for ReactFlow nodes
    edges: z.array(z.record(z.string(), z.any())), // Simplification for ReactFlow edges
    isActive: z.boolean().default(false)
});

// --- Schedule Validation ---
export const createScheduleSchema = z.object({
    name: z.string().min(1),
    cron: z.string().min(1, "Cron expression required"),
    timezone: z.string().default("UTC"),
    isActive: z.boolean().default(true),
    // Config
    batchSize: z.number().int().positive().default(50),
    groundingConfig: z.object({
        useRag: z.boolean().optional(),
        collectionId: z.string().optional()
    }).optional().nullable(),
    // Relations
    campaignId: idSchema.optional().nullable(),
    agentId: idSchema.optional().nullable()
});

// --- Team Member Validation ---
export const inviteMemberSchema = z.object({
    email: emailSchema,
    role: z.enum(["owner", "admin", "member", "viewer"]).default("member")
});

// --- Knowledge Upload ---
export const uploadKnowledgeSchema = z.object({
    knowledgeBaseId: idSchema,
    content: z.string().min(1, "Content is required").max(50000),
    metadata: z.record(z.string(), z.any()).optional()
});

export const agentToneConfigSchema = z.object({
    formality: z.number().min(0).max(100).default(50),
    directness: z.number().min(0).max(100).default(50),
    talkingPoints: z.array(z.string()).default([]),
    avoidWords: z.array(z.string()).default([])
});

export const studioPreviewSchema = z.object({
    templateId: z.string().optional(),
    content: z.string().optional(),
    variables: z.record(z.string(), z.any()).optional(),
    context: z.string().optional(),
    mission: z.string().optional(),
    config: agentToneConfigSchema.optional()
});

// --- Validation Middleware Helper ---
export function validateRequest<T extends z.ZodTypeAny>(schema: T) {
    return async (data: unknown): Promise<z.infer<T>> => {
        return schema.parse(data);
    };
}
