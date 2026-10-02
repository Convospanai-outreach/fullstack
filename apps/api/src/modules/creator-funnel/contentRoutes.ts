import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { ContentPostError, isValidTimeZone } from "./contentPostService";

// Shared pieces of the /content/* routes: the team context behind the creator-funnel flag,
// the post payload schema, and ContentPostError -> HTTP status.

const FUNNEL_STAGES = ["TOFU", "MOFU", "BOFU", "POST"] as const;

const postFields = {
    body: z.string().max(10000),
    funnelStage: z.enum(FUNNEL_STAGES),
    mediaUrls: z.array(z.string().max(500)).max(10),
    scheduledAt: z.iso.datetime({ offset: true }).nullable(),
    timezone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone").nullable(),
    accountIds: z.array(z.string().max(64)).max(10),
    channelCaptions: z.object({ INSTAGRAM: z.string().max(10000).optional(), LINKEDIN: z.string().max(10000).optional() }),
    visualBrief: z.string().max(2000).nullable(),
};

export const createPostSchema = z.object({
    ...postFields,
    body: postFields.body.default(""),
    mediaUrls: postFields.mediaUrls.default([]),
    scheduledAt: postFields.scheduledAt.default(null),
    timezone: postFields.timezone.default(null),
    accountIds: postFields.accountIds.default([]),
    channelCaptions: postFields.channelCaptions.default({}),
    visualBrief: postFields.visualBrief.default(null),
});

export const updatePostSchema = z.object(postFields).partial();

// The playbook wizard (playbookWizard.ts): an offer (a checkout product or a call booked through
// the team's own booking link), an audience (an existing ICP or a description), a lead magnet,
// a tone and a start date.
export const playbookWizardSchema = z.object({
    name: z.string().trim().min(1).max(120),
    offer: z.discriminatedUnion("type", [
        z.object({ type: z.literal("product"), productId: z.string().max(64) }),
        z.object({ type: z.literal("booking"), bookingUrl: z.string().trim().max(500), description: z.string().trim().min(3).max(500) }),
    ]),
    audience: z.union([
        z.object({ icpId: z.string().max(64) }),
        z.object({ description: z.string().trim().min(3).max(500) }),
    ]),
    leadMagnet: z.string().trim().min(3).max(500),
    tone: z.string().trim().min(1).max(100),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    timezone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone"),
    postsPerWeek: z.number().int().min(2).max(5).default(3),
    accountIds: z.array(z.string().max(64)).max(10).default([]),
    // The word commenters type to get the lead magnet (the plan's keyword auto-reply).
    keyword: z.string().trim().regex(/^[\p{L}\p{N}]{2,30}$/u, "One word of letters and numbers").optional(),
});

export type PlaybookWizardInput = z.infer<typeof playbookWizardSchema>;

/** ISO string -> Date, keeping null (clear) and undefined (leave as is) apart. */
export function parseWhen(value: string | null | undefined): Date | null | undefined {
    return value == null ? value : new Date(value);
}

export type CreatorContext = { userId: string; teamId: string };

/**
 * The signed-in user's team, or a ready 401/403/404 response (404 while the flag is off).
 * Writes need at least a member, like campaigns: viewers can look but not change posts.
 */
export async function creatorContext(req: NextRequest, access: "read" | "write" = "read"): Promise<CreatorContext | NextResponse> {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { isCreatorFunnelEnabled } = await import("./featureGate");
    if (!(await isCreatorFunnelEnabled(teamId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (access === "write" && !(await checkTeamPermission(userId, teamId, TeamRole.MEMBER))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return { userId, teamId };
}

export function contentError(error: unknown) {
    if (error instanceof ContentPostError) return NextResponse.json({ error: error.message }, { status: error.status });
    return handleAPIError(error);
}
