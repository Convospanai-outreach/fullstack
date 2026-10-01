import { FunnelStage, Prisma, SocialPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeAutoDenyAt, resolveApprovalTier } from "@/modules/governance/approvalPolicy";
import { getBreakerState } from "@/modules/overseer/breakerService";

// Creator funnel content calendar. A post is a DRAFT until someone sends it for approval
// (IN_REVIEW, backed by an ApprovalRequest that shows in Inbox > Approvals). Only an APPROVED
// post is ever published (phase 3b). Editing the text, media or accounts of a post that's in
// review or approved sends it back to DRAFT, so nothing publishes that no one approved.
// Moving an approved post to another time keeps the approval (the approver approved the
// content; the time was on the approval card and can be moved by the author).

// The transaction client of the (extended) app client, which Prisma.TransactionClient doesn't match.
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const CONTENT_POST_ACTION = "CONTENT_POST_PUBLISH";
export const CONTENT_POST_ENTITY = "ContentPost";

export const DEFAULT_STAGE_MIX: Record<FunnelStage, number> = { TOFU: 60, MOFU: 30, BOFU: 10, POST: 0 };

const EDITABLE = ["DRAFT", "IN_REVIEW", "APPROVED", "FAILED"] as const;
const SUBMITTABLE = ["DRAFT", "FAILED"] as const;

export class ContentPostError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
    FACEBOOK_PAGE: "Facebook Page",
    INSTAGRAM: "Instagram",
    LINKEDIN_MEMBER: "LinkedIn profile",
    LINKEDIN_ORG: "LinkedIn page",
};

// Instagram limits, checked when a post is sent for approval so an approved post doesn't fail
// at publish time. Checked 2026-09-30:
// https://developers.facebook.com/documentation/instagram-platform/content-publishing.md
//   "JPEG is the only image format supported"; "Carousels are limited to 10 images, videos, or a mix".
// https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
//   caption "Maximum 2200 characters", "30 hashtags", "20 @ tags"; image "8 MB maximum",
//   aspect ratio "within a 4:5 to 1.91:1 range" (size and ratio are checked at upload in apps/web).
// The permission each platform needs to publish (Pages API posts: pages_manage_posts; Instagram
// content publishing: instagram_content_publish; both checked 2026-10-01, see contentPublisher.ts).
export const PUBLISH_SCOPE: Record<string, string> = { FACEBOOK_PAGE: "pages_manage_posts", INSTAGRAM: "instagram_content_publish" };

export const INSTAGRAM_LIMITS = { caption: 2200, hashtags: 30, mentions: 20, media: 10 };

export function instagramProblems(body: string, mediaUrls: string[]): string[] {
    const problems: string[] = [];
    if (mediaUrls.length === 0) problems.push("Instagram posts need at least one image.");
    if (mediaUrls.length > INSTAGRAM_LIMITS.media) problems.push(`Instagram allows at most ${INSTAGRAM_LIMITS.media} images in one post.`);
    if ([...body].length > INSTAGRAM_LIMITS.caption) problems.push(`Instagram captions can be at most ${INSTAGRAM_LIMITS.caption} characters.`);
    if ((body.match(/#[\p{L}\p{N}_]+/gu) || []).length > INSTAGRAM_LIMITS.hashtags) problems.push(`Instagram allows at most ${INSTAGRAM_LIMITS.hashtags} hashtags.`);
    if ((body.match(/@[\w.]+/g) || []).length > INSTAGRAM_LIMITS.mentions) problems.push(`Instagram allows at most ${INSTAGRAM_LIMITS.mentions} @ tags.`);
    return problems;
}

// Media must be a JPEG the web app uploaded to this team's folder in the public `content-media`
// bucket. Meta fetches it from this URL at publish time, so no other URL is accepted. When
// SUPABASE_URL is set here the host must match it exactly.
export function isOwnMediaUrl(url: string, teamId: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    const configured = process.env["SUPABASE_URL"];
    const hostOk = configured
        ? parsed.origin === new URL(configured).origin
        : parsed.protocol === "https:" && /^[a-z0-9]{20}\.supabase\.co$/.test(parsed.hostname);
    if (!hostOk || parsed.search || parsed.hash) return false;
    const folder = teamId.replace(/[^a-zA-Z0-9_-]/g, "");
    return new RegExp(`^/storage/v1/object/public/content-media/${folder}/[0-9a-f-]{36}\\.jpg$`).test(parsed.pathname);
}

export function isValidTimeZone(tz: string): boolean {
    try {
        new Intl.DateTimeFormat("en-GB", { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

function formatWhen(at: Date, timezone: string | null): string {
    const tz = timezone && isValidTimeZone(timezone) ? timezone : "UTC";
    const text = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(at);
    return `${text} (${tz})`;
}

const POST_INCLUDE = {
    targets: {
        select: {
            id: true, status: true, externalId: true, publishedAt: true, lastError: true,
            socialAccount: { select: { id: true, platform: true, handle: true, status: true } },
        },
    },
} satisfies Prisma.ContentPostInclude;

export type PostInput = {
    body: string;
    funnelStage: FunnelStage;
    mediaUrls: string[];
    scheduledAt: Date | null;
    timezone: string | null;
    accountIds: string[];
};

async function assertAccounts(teamId: string, accountIds: string[]) {
    if (accountIds.length === 0) return;
    const found = await prisma.socialAccount.count({ where: { teamId, id: { in: accountIds }, status: { not: "DISCONNECTED" } } });
    if (found !== new Set(accountIds).size) throw new ContentPostError(400, "Pick accounts that are connected to this workspace.");
}

function assertMedia(teamId: string, mediaUrls: string[]) {
    if (mediaUrls.some((url) => !isOwnMediaUrl(url, teamId))) {
        throw new ContentPostError(400, "Upload images through the post editor.");
    }
}

function assertFuture(scheduledAt: Date | null) {
    if (scheduledAt && scheduledAt.getTime() <= Date.now()) throw new ContentPostError(400, "Pick a time in the future.");
}

export async function listPosts(teamId: string, from: Date, to: Date) {
    const [scheduled, unscheduled] = await Promise.all([
        prisma.contentPost.findMany({
            where: { teamId, scheduledAt: { gte: from, lt: to } },
            include: POST_INCLUDE,
            orderBy: { scheduledAt: "asc" },
            take: 500,
        }),
        prisma.contentPost.findMany({
            where: { teamId, scheduledAt: null },
            include: POST_INCLUDE,
            orderBy: { updatedAt: "desc" },
            take: 50,
        }),
    ]);
    return { posts: scheduled, unscheduled };
}

export async function createPost(teamId: string, userId: string, input: PostInput) {
    assertMedia(teamId, input.mediaUrls);
    assertFuture(input.scheduledAt);
    await assertAccounts(teamId, input.accountIds);
    return prisma.contentPost.create({
        data: {
            teamId,
            createdById: userId,
            body: input.body,
            funnelStage: input.funnelStage,
            mediaUrls: input.mediaUrls,
            scheduledAt: input.scheduledAt,
            timezone: input.timezone,
            targets: { create: [...new Set(input.accountIds)].map((socialAccountId) => ({ socialAccountId })) },
        },
        include: POST_INCLUDE,
    });
}

async function loadPost(teamId: string, postId: string) {
    const post = await prisma.contentPost.findFirst({ where: { id: postId, teamId }, include: { targets: { select: { socialAccountId: true, status: true } } } });
    if (!post) throw new ContentPostError(404, "Post not found");
    return post;
}

async function withdrawApproval(tx: Tx, teamId: string, approvalRequestId: string | null, note: string) {
    if (!approvalRequestId) return;
    await tx.approvalRequest.updateMany({
        where: { id: approvalRequestId, teamId, status: "PENDING" },
        data: { status: "REJECTED", reviewNote: note, reviewedAt: new Date() },
    });
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export async function updatePost(teamId: string, postId: string, patch: Partial<PostInput>) {
    const post = await loadPost(teamId, postId);
    if (!(EDITABLE as readonly string[]).includes(post.status)) throw new ContentPostError(409, "Published posts can't be changed.");
    if (patch.mediaUrls) assertMedia(teamId, patch.mediaUrls);
    if (patch.accountIds) await assertAccounts(teamId, patch.accountIds);

    const currentAccounts = post.targets.map((t) => t.socialAccountId);
    const accountIds = patch.accountIds ? [...new Set(patch.accountIds)] : currentAccounts;
    // A PUBLISHED target is the only record of where the post is live.
    if (post.targets.some((t) => t.status === "PUBLISHED" && !accountIds.includes(t.socialAccountId))) {
        throw new ContentPostError(409, "This post is already live on an account you removed. Keep that account selected.");
    }
    const contentChanged =
        (patch.body !== undefined && patch.body !== post.body) ||
        (patch.mediaUrls !== undefined && !(patch.mediaUrls.length === post.mediaUrls.length && patch.mediaUrls.every((u, i) => u === post.mediaUrls[i]))) ||
        !sameSet(accountIds, currentAccounts);
    const inApproval = post.status === "IN_REVIEW" || post.status === "APPROVED";
    const backToDraft = inApproval && contentChanged;

    const scheduledAt = patch.scheduledAt !== undefined ? patch.scheduledAt : post.scheduledAt;
    const rescheduled = patch.scheduledAt !== undefined && patch.scheduledAt?.getTime() !== post.scheduledAt?.getTime();
    if (rescheduled) assertFuture(patch.scheduledAt ?? null);
    if (inApproval && !backToDraft && !scheduledAt) throw new ContentPostError(400, "A post in review or approved needs a time.");

    const timezone = patch.timezone !== undefined ? patch.timezone : post.timezone;

    await prisma.$transaction(async (tx) => {
        const res = await tx.contentPost.updateMany({
            where: { id: postId, teamId, updatedAt: post.updatedAt },
            data: {
                ...(patch.body !== undefined ? { body: patch.body } : {}),
                ...(patch.funnelStage !== undefined ? { funnelStage: patch.funnelStage } : {}),
                ...(patch.mediaUrls !== undefined ? { mediaUrls: patch.mediaUrls } : {}),
                ...(patch.scheduledAt !== undefined ? { scheduledAt: patch.scheduledAt } : {}),
                ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
                ...(backToDraft
                    ? { status: "DRAFT", approvalRequestId: null, reviewNote: "Edited after it was sent for approval. Send it again." }
                    : {}),
            },
        });
        if (res.count !== 1) throw new ContentPostError(409, "This post changed while you were editing. Reload and try again.");

        if (patch.accountIds && !sameSet(accountIds, currentAccounts)) {
            await tx.contentPostTarget.deleteMany({ where: { postId, socialAccountId: { notIn: accountIds }, status: { not: "PUBLISHED" } } });
            await tx.contentPostTarget.createMany({ data: accountIds.map((socialAccountId) => ({ postId, socialAccountId })), skipDuplicates: true });
        }
        if (backToDraft) {
            await withdrawApproval(tx, teamId, post.approvalRequestId, "Withdrawn: the post was edited");
        } else if (post.status === "IN_REVIEW" && rescheduled && scheduledAt && post.approvalRequestId) {
            // Keep the pending approval card's time in step with the post.
            const request = await tx.approvalRequest.findFirst({ where: { id: post.approvalRequestId, teamId, status: "PENDING" }, select: { payload: true } });
            if (request) {
                await tx.approvalRequest.updateMany({
                    where: { id: post.approvalRequestId, teamId, status: "PENDING" },
                    data: { payload: { ...((request.payload as object) || {}), subject: await approvalSubject(tx, postId, scheduledAt, timezone) } },
                });
            }
        }
    });

    return prisma.contentPost.findFirst({ where: { id: postId, teamId }, include: POST_INCLUDE });
}

export async function deletePost(teamId: string, postId: string) {
    const post = await loadPost(teamId, postId);
    if (post.status === "PUBLISHING" || post.status === "PUBLISHED" || post.targets.some((t) => t.status === "PUBLISHED")) {
        throw new ContentPostError(409, "Part of this post is already live, so it can't be deleted here.");
    }
    await prisma.$transaction(async (tx) => {
        await withdrawApproval(tx, teamId, post.approvalRequestId, "Withdrawn: the post was deleted");
        const res = await tx.contentPost.deleteMany({ where: { id: postId, teamId, status: { in: [...EDITABLE] } } });
        if (res.count !== 1) throw new ContentPostError(409, "This post changed. Reload and try again.");
    });
}

async function approvalSubject(db: Tx, postId: string, at: Date, timezone: string | null) {
    const targets = await db.contentPostTarget.findMany({ where: { postId, status: { not: "PUBLISHED" } }, select: { socialAccount: { select: { platform: true } } } });
    const platforms = [...new Set(targets.map((t) => PLATFORM_LABEL[t.socialAccount.platform]))].join(" + ");
    return `${platforms} post, ${formatWhen(at, timezone)}`;
}

export async function submitPost(teamId: string, postId: string, userId: string) {
    const post = await prisma.contentPost.findFirst({
        where: { id: postId, teamId },
        include: { targets: { select: { status: true, socialAccount: { select: { platform: true, handle: true, status: true, scopes: true } } } } },
    });
    if (!post) throw new ContentPostError(404, "Post not found");
    // On a retry after a partial failure, only the accounts it didn't reach are posted to again.
    const targets = post.targets.filter((t) => t.status !== "PUBLISHED");
    if (!(SUBMITTABLE as readonly string[]).includes(post.status)) throw new ContentPostError(409, "This post is already in review or approved.");
    if (!post.body.trim() && post.mediaUrls.length === 0) throw new ContentPostError(400, "Write something or add an image first.");
    if (!post.scheduledAt) throw new ContentPostError(400, "Pick a time first.");
    assertFuture(post.scheduledAt);
    if (targets.length === 0) throw new ContentPostError(400, post.targets.length ? "This post is already live on every account it targets." : "Pick at least one account.");
    if (targets.some((t) => t.socialAccount.status !== "CONNECTED")) {
        throw new ContentPostError(400, "Reconnect the accounts marked in Settings > Social accounts first.");
    }
    const unsupported = targets.find((t) => !PUBLISH_SCOPE[t.socialAccount.platform]);
    if (unsupported) throw new ContentPostError(400, `Posting to ${PLATFORM_LABEL[unsupported.socialAccount.platform]} isn't available yet.`);
    const noPermission = targets.find((t) => !t.socialAccount.scopes.includes(PUBLISH_SCOPE[t.socialAccount.platform]));
    if (noPermission) {
        throw new ContentPostError(400, `${noPermission.socialAccount.handle || PLATFORM_LABEL[noPermission.socialAccount.platform]} wasn't given permission to post. Reconnect it in Settings > Social accounts and allow posting.`);
    }
    if (targets.some((t) => t.socialAccount.platform === "INSTAGRAM")) {
        const problems = instagramProblems(post.body, post.mediaUrls);
        if (problems.length) throw new ContentPostError(400, problems.join(" "));
    }

    const tier = resolveApprovalTier(CONTENT_POST_ACTION);
    const extended = (await getBreakerState(teamId)) !== "CLOSED";
    const scheduledAt = post.scheduledAt;

    return prisma.$transaction(async (tx) => {
        const request = await tx.approvalRequest.create({
            data: {
                teamId,
                requesterId: userId,
                actionType: CONTENT_POST_ACTION,
                entityType: CONTENT_POST_ENTITY,
                entityId: post.id,
                status: "PENDING",
                tier,
                autoDenyAt: computeAutoDenyAt(tier, new Date(), extended),
                payload: {
                    subject: await approvalSubject(tx, post.id, scheduledAt, post.timezone),
                    recipient: targets.map((t) => `${t.socialAccount.handle || "Account"} (${PLATFORM_LABEL[t.socialAccount.platform]})`).join(", "),
                    body: post.body,
                    mediaUrls: post.mediaUrls,
                },
            },
        });
        const res = await tx.contentPost.updateMany({
            where: { id: post.id, teamId, updatedAt: post.updatedAt, status: { in: [...SUBMITTABLE] } },
            data: { status: "IN_REVIEW", approvalRequestId: request.id, reviewNote: null },
        });
        if (res.count !== 1) throw new ContentPostError(409, "This post changed while sending. Reload and try again.");
        return { approvalRequestId: request.id };
    });
}

/**
 * Applies a reviewer's decision on a CONTENT_POST_PUBLISH approval. Only a PENDING request
 * moves, and only the post it's currently attached to (so approving a stale card after an
 * edit changes nothing). An approval that arrives after the post's time sends it back to
 * DRAFT instead of publishing late. Returns false when nothing changed.
 */
export async function decideContentPost(
    teamId: string,
    requestId: string,
    reviewerId: string,
    decision: "APPROVED" | "REJECTED",
    note?: string
): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
        const now = new Date();
        const moved = await tx.approvalRequest.updateMany({
            where: { id: requestId, teamId, status: "PENDING", actionType: CONTENT_POST_ACTION },
            // reviewerId is a User FK; the auto-deny sweep passes "system-timeout".
            data: {
                status: decision,
                reviewedAt: now,
                ...(reviewerId.startsWith("system-") ? {} : { reviewerId }),
                ...(note ? { reviewNote: note } : {}),
            },
        });
        if (moved.count !== 1) return false;

        const attached = { teamId, status: "IN_REVIEW" as const, approvalRequestId: requestId };
        if (decision === "REJECTED") {
            await tx.contentPost.updateMany({
                where: attached,
                data: {
                    status: "DRAFT",
                    approvalRequestId: null,
                    reviewNote: reviewerId === "system-timeout"
                        ? "Nobody reviewed it in time. Send it again."
                        : note ? `Not approved: ${note}` : "Not approved.",
                },
            });
            return true;
        }
        const approved = await tx.contentPost.updateMany({ where: { ...attached, scheduledAt: { gt: now } }, data: { status: "APPROVED" } });
        if (approved.count === 0) {
            await tx.contentPost.updateMany({
                where: attached,
                data: { status: "DRAFT", approvalRequestId: null, reviewNote: "The scheduled time passed before approval. Pick a new time." },
            });
        }
        return true;
    });
}

export async function getStageMix(teamId: string): Promise<Record<FunnelStage, number>> {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { contentStageMix: true } });
    const stored = team?.contentStageMix as Record<string, unknown> | null;
    if (!stored) return { ...DEFAULT_STAGE_MIX };
    const mix = { ...DEFAULT_STAGE_MIX };
    for (const stage of Object.keys(mix) as FunnelStage[]) {
        if (typeof stored[stage] === "number") mix[stage] = stored[stage] as number;
    }
    return mix;
}

export async function setStageMix(teamId: string, mix: Record<FunnelStage, number>) {
    await prisma.team.update({ where: { id: teamId }, data: { contentStageMix: mix } });
    return mix;
}
