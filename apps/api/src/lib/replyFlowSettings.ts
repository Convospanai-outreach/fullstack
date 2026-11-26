import { z } from "zod";
import { captureException } from "./sentry";
import { isValidTimeZone, resolveSendWindow } from "./sendWindow";

const pauseSchema = z.object({
    confidence: z.number().min(0.7).max(1).default(0.7),
    holdHours: z.number().int().min(1).max(24).default(24),
});
const replyFlowSettingsObject = z.object({
    scheduledReplies: z.boolean().default(true),
    delayChoices: z.array(z.union([z.literal(1), z.literal(24)])).min(1).max(2)
        .refine(values => new Set(values).size === values.length, "Choose distinct delays.").default([1, 24]),
    followUpPlans: z.boolean().default(false),
    maxSteps: z.number().int().min(1).max(4).default(4),
    minSpacingHours: z.number().int().min(24).max(336).default(24),
    approvalHours: z.number().int().min(1).max(72).default(72),
    autoPause: pauseSchema.default({ confidence: 0.7, holdHours: 24 }),
    notifications: z.boolean().default(true),
});
export const replyFlowSettingsSchema = replyFlowSettingsObject.strict();
export const sendWindowSettingsSchema = z.object({
    enabled: z.boolean(),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    timeZone: z.string().refine(isValidTimeZone, "Choose a valid timezone."),
}).strict().refine(value => value.startHour < value.endHour, "The end hour must be after the start hour.");
export const replyFlowUpdateSchema = replyFlowSettingsObject.extend({ sendWindow: sendWindowSettingsSchema.optional() }).strict();
export type ReplyFlowSettings = z.infer<typeof replyFlowSettingsSchema>;

export function readReplySendingWindow(teamSettings: unknown) {
    return resolveSendWindow(teamSettings && typeof teamSettings === "object" && "sendWindow" in teamSettings ? teamSettings.sendWindow : null);
}

export function readReplyFlowSettings(teamSettings: unknown) {
    const blob = teamSettings && typeof teamSettings === "object" && "replyFlow" in teamSettings ? teamSettings.replyFlow : undefined;
    const parsed = replyFlowSettingsObject.safeParse(blob === undefined ? {} : blob);
    if (parsed.success) return { settings: parsed.data, invalid: false };
    captureException(new Error("Saved reply-flow settings failed validation."));
    return { settings: replyFlowSettingsSchema.parse({ scheduledReplies: false }), invalid: true };
}

export function resolveReplyFlowSettings(teamSettings: unknown): ReplyFlowSettings {
    return readReplyFlowSettings(teamSettings).settings;
}
