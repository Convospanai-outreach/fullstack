import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";
import { ContentPostError, isValidTimeZone } from "./contentPostService";

// Shared pieces of the /content/* routes: the team context behind the creator-funnel flag,
// the post payload schema, and ContentPostError -> HTTP status.

export const FUNNEL_STAGES = ["TOFU", "MOFU", "BOFU", "POST"] as const;

const postFields = {
    body: z.string().max(10000),
    funnelStage: z.enum(FUNNEL_STAGES),
    mediaUrls: z.array(z.string().max(500)).max(10),
    scheduledAt: z.iso.datetime({ offset: true }).nullable(),
    timezone: z.string().max(64).refine(isValidTimeZone, "Unknown time zone").nullable(),
    accountIds: z.array(z.string().max(64)).max(10),
};

export const createPostSchema = z.object({
    ...postFields,
    body: postFields.body.default(""),
    mediaUrls: postFields.mediaUrls.default([]),
    scheduledAt: postFields.scheduledAt.default(null),
    timezone: postFields.timezone.default(null),
    accountIds: postFields.accountIds.default([]),
});

export const updatePostSchema = z.object(postFields).partial();

/** ISO string -> Date, keeping null (clear) and undefined (leave as is) apart. */
export function parseWhen(value: string | null | undefined): Date | null | undefined {
    return value == null ? value : new Date(value);
}

export type CreatorContext = { userId: string; teamId: string };

/** The signed-in user's team, or a ready 401/404 response (404 while the flag is off). */
export async function creatorContext(req: NextRequest): Promise<CreatorContext | NextResponse> {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { isCreatorFunnelEnabled } = await import("./featureGate");
    if (!(await isCreatorFunnelEnabled(teamId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return { userId, teamId };
}

export function contentError(error: unknown) {
    if (error instanceof ContentPostError) return NextResponse.json({ error: error.message }, { status: error.status });
    return handleAPIError(error);
}
