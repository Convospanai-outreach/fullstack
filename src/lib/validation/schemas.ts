import { z } from "zod";

// Common validation schemas
export const emailSchema = z.string().email("Invalid email address");

export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20)
});

export const idSchema = z.string().uuid("Invalid ID format");

// Campaign validation
export const createCampaignSchema = z.object({
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().max(1000).optional(),
    audience: z.string().max(500).optional(),
    status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
    // Advanced fields
    scheduledStart: z.string().datetime().optional().nullable(),
    aiConfig: z.object({
        tone: z.string().optional(),
        goal: z.string().optional(),
        context: z.string().optional()
    }).optional().nullable(),
    targetCount: z.number().int().nonnegative().optional().default(0)
});

// Lead validation
export const createLeadSchema = z.object({
    fullName: z.string().min(1, "Full name is required").max(200).optional().nullable(),
    email: emailSchema.optional().nullable(),
    phone: z.string().max(50).optional().nullable(), // Added phone
    company: z.string().max(200).optional().nullable(),
    jobTitle: z.string().max(200).optional().nullable(), // Changed from title to jobTitle to match Prisma
    linkedinUrl: z.string().url().optional().nullable().or(z.literal("")), // Renamed to match but Prisma has linkedIn. We map in service usually or should match here.
    location: z.string().max(200).optional().nullable(),

    // Status & Tags
    status: z.enum(["NEW", "CONTACTED", "REPLIED", "CONVERTED", "LOST"]).optional().default("NEW"),
    tags: z.array(z.string()).optional(),

    // Advanced / Analytics
    intentScore: z.number().min(0).max(1).optional(),
    campaignId: z.string().uuid().optional().nullable(),
    teamId: z.string().uuid().optional()
});

// Team member validation
export const inviteMemberSchema = z.object({
    email: emailSchema,
    role: z.enum(["owner", "admin", "member", "viewer"]).default("member")
});

// Studio preview validation
export const studioPreviewSchema = z.object({
    context: z.string().min(1, "Context is required"),
    mission: z.string().min(1, "Mission is required"),
    config: z.object({
        formality: z.number().int().min(0).max(100),
        directness: z.number().int().min(0).max(100),
        talkingPoints: z.array(z.string()).max(10),
        avoidWords: z.array(z.string()).max(20)
    }).optional()
});

// Knowledge upload validation
export const uploadKnowledgeSchema = z.object({
    knowledgeBaseId: idSchema,
    content: z.string().min(1, "Content is required").max(50000),
    metadata: z.record(z.string(), z.any()).optional()
});

// Validation middleware helper
export function validateRequest<T extends z.ZodTypeAny>(schema: T) {
    return async (data: unknown): Promise<z.infer<T>> => {
        return schema.parse(data);
    };
}
