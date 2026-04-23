import { z } from "zod";

export const landingFrameworkEnum = z.enum([
    "PAS",
    "AIDA",
    "MYTH_CORRECTION",
    "BEFORE_AFTER_BRIDGE",
    "STORY_OFFER_PS",
]);

export const createLandingCampaignSchema = z.object({
    name: z.string().min(1).max(200),
    prompt: z.string().min(1).max(10000),
    framework: landingFrameworkEnum.optional(),
    linkedCampaignId: z.string().uuid().optional().nullable(),
});

export const addLandingAssetSchema = z.object({
    text: z.string().max(50000).optional(),
    pdfKnowledgeItemId: z.string().uuid().optional(),
    sourceName: z.string().max(255).optional(),
});

export const generateBriefSchema = z.object({
    framework: landingFrameworkEnum.optional(),
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
    rawPayload: z.unknown().optional(),
    utmSource: z.string().max(200).optional(),
    utmMedium: z.string().max(200).optional(),
    utmCampaign: z.string().max(200).optional(),
    utmTerm: z.string().max(200).optional(),
    utmContent: z.string().max(200).optional(),
    referrer: z.string().max(2000).optional(),
    website: z.string().max(500).optional(), // honeypot
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
    eventData: z.unknown().optional(),
    website: z.string().max(500).optional(), // honeypot
});

export type LandingFramework = z.infer<typeof landingFrameworkEnum>;
export type LandingLeadPayload = z.infer<typeof landingLeadPayloadSchema>;
export type LandingEventPayload = z.infer<typeof landingEventPayloadSchema>;
