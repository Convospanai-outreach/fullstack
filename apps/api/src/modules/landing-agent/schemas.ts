import { z } from "zod";
import { getLandingTemplate } from "./landingTemplates";

const PROMPT_GUARD_PATTERN = /\b(ignore|disregard|bypass)\s+(all\s+)?(previous|prior)\s+(instructions?|rules?)\b|<script[\s\S]*?>|javascript:/i;

function isJsonWithinSize(value: unknown, maxChars: number): boolean {
    if (typeof value === "undefined") return true;
    try {
        return JSON.stringify(value).length <= maxChars;
    } catch {
        return false;
    }
}

export const landingFrameworkEnum = z.enum([
    "PAS",
    "AIDA",
    "MYTH_CORRECTION",
    "BEFORE_AFTER_BRIDGE",
    "STORY_OFFER_PS",
]);

export const createLandingCampaignSchema = z.object({
    name: z.string().min(1).max(200),
    prompt: z
        .string()
        .min(1)
        .max(4000)
        .refine((value) => !PROMPT_GUARD_PATTERN.test(value), "Prompt contains blocked instructions."),
    framework: landingFrameworkEnum.optional(),
    linkedCampaignId: z.string().uuid().optional().nullable(),
    // A saved ICP is a prerequisite for creating a landing campaign - it's the
    // audience context the brief-generation prompt needs.
    icpId: z.string().uuid(),
});

export const addLandingAssetSchema = z.object({
    text: z
        .string()
        .max(15000)
        .refine((value) => !PROMPT_GUARD_PATTERN.test(value), "Asset text contains blocked instructions.")
        .optional(),
    pdfKnowledgeItemId: z.string().uuid().optional(),
    sourceName: z.string().max(255).optional(),
});

export const generateBriefSchema = z.object({
    framework: landingFrameworkEnum.optional(),
});

// A page's path name: its address under each connected domain, e.g. "spring-guide".
// Keep the rule in step with PAGE_PATH_PATTERN in apps/web/src/components/landing-agent/landingPageAddress.ts.
export const landingPagePathSchema = z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "Use 2 to 63 letters, numbers or hyphens, starting with a letter or number.");

export const createLandingFromTemplateSchema = z.object({
    templateId: z.string().max(60).refine((id) => getLandingTemplate(id) !== undefined, "Unknown template"),
    name: z.string().trim().min(1).max(200),
    path: landingPagePathSchema.optional(),
});

export const setPageSlugSchema = z.object({
    path: landingPagePathSchema,
});

// A/B test (phase 6B): the test path uses the same rule as a page path.
export const createExperimentSchema = z.object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    pageAId: z.string().min(1).max(64),
    pageBId: z.string().min(1).max(64),
    weightA: z.number().int().min(1).max(99),
});

export const pickWinnerSchema = z.object({
    pageId: z.string().min(1).max(64),
});

export const selectWireframeSchema = z.object({
    wireframeId: z.string().uuid(),
});

export const editorStateSchema = z.object({
    title: z.string().max(200).optional(),
    editorState: z.unknown().optional(),
    renderedJson: z.unknown(),
});

export const publishCampaignSchema = z.object({
    requireApproval: z.boolean().optional().default(false),
});

export const landingLeadPayloadSchema = z.object({
    sessionId: z.string().max(255).optional(),
    pageVersion: z.number().int().positive().optional(),
    name: z.string().max(200).optional(),
    email: z.string().email().max(320).optional(),
    phone: z.string().max(50).optional(),
    company: z.string().max(200).optional(),
    title: z.string().max(200).optional(),
    rawPayload: z
        .unknown()
        .refine((value) => isJsonWithinSize(value, 10000), "rawPayload exceeds 10k serialized size")
        .optional(),
    utmSource: z.string().max(200).optional(),
    utmMedium: z.string().max(200).optional(),
    utmCampaign: z.string().max(200).optional(),
    utmTerm: z.string().max(200).optional(),
    utmContent: z.string().max(200).optional(),
    referrer: z.string().max(2000).optional(),
    socialToken: z.string().max(300).optional(), // creator funnel ?t= link token, verified by the intake worker
    whatsappConsent: z.boolean().optional(), // creator funnel pages' WhatsApp opt-in checkbox
    website: z.string().max(500).optional(), // honeypot
    // Lead form marker pages: the visitor's values by field key. Checked against the page's config in the service.
    formFields: z.record(z.string().max(64), z.unknown()).optional(),
});

export const landingEventNameEnum = z.enum([
    "page_view",
    "cta_click",
    "form_start",
    "form_submit",
    "scroll_depth",
]);

export const landingEventPayloadSchema = z.object({
    sessionId: z.string().max(255).optional(),
    pageVersion: z.number().int().positive().optional(),
    eventName: landingEventNameEnum,
    eventData: z
        .unknown()
        .refine((value) => isJsonWithinSize(value, 8000), "eventData exceeds 8k serialized size")
        .optional(),
    // UTM of the page URL, for attribution (apps/api src/lib/utm.ts)
    utmSource: z.string().max(200).optional(),
    utmMedium: z.string().max(200).optional(),
    utmCampaign: z.string().max(200).optional(),
    utmTerm: z.string().max(200).optional(),
    utmContent: z.string().max(200).optional(),
    website: z.string().max(500).optional(), // honeypot
});

export type LandingFramework = z.infer<typeof landingFrameworkEnum>;
export type LandingLeadPayload = z.infer<typeof landingLeadPayloadSchema>;
export type LandingEventPayload = z.infer<typeof landingEventPayloadSchema>;
