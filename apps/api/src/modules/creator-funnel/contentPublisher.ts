import { prisma } from "@/lib/db";
import { decryptCredential, type EncryptedCredential } from "@/lib/security/credentialVault";
import { CONTENT_POST_ACTION, CONTENT_POST_ENTITY, PUBLISH_SCOPE, captionFor } from "./contentPostService";
import { GraphError, graphCall } from "./metaGraph";

// Creator funnel publisher (phase 3b). Runs every minute from the worker tick and only ever
// publishes APPROVED posts whose time has come, whose ApprovalRequest is APPROVED, on teams
// with the creator funnel on. Each target (one connected account) is published at most once:
// it moves to SENDING right before the one call that makes it public, and a target found in
// SENDING later (a crash or timeout mid-call) is never sent blindly again.
//
// Both API VMs run this loop, so a post is worked on only under a lease (publishLeaseUntil).
// A tick stops starting new work after TICK_BUDGET_MS, and the lease is longer than the
// slowest possible run for one post (one more target after the budget, at most 14 calls x 15s), so a lease can't expire
// while a call is still in flight.
//
// Platform rules, checked 2026-10-01:
// - Facebook Page posts (https://developers.facebook.com/docs/pages-api/posts): text via
//   POST /{page-id}/feed (message); a photo via POST /{page-id}/photos (url, caption), which
//   returns id and post_id; needs a Page token with pages_manage_posts. We don't use
//   scheduled_publish_time: once a post is handed to Meta, editing it here couldn't stop it.
// - Several photos (https://developers.facebook.com/docs/graph-api/reference/page/photos/):
//   upload each with published=false (kept ~24 hours), then POST /{page-id}/feed with
//   attached_media[i]={"media_fbid":"<photo id>"}.
// - Instagram (https://developers.facebook.com/documentation/instagram-platform/content-publishing.md):
//   POST /{ig-id}/media (image_url, caption) creates a container; a carousel is one container
//   per image with is_carousel_item=true, then media_type=CAROUSEL with children (up to 10).
//   GET /{container-id}?fields=status_code -> EXPIRED | ERROR | FINISHED | IN_PROGRESS |
//   PUBLISHED; "querying a container's status once per minute, for no more than 5 minutes".
//   POST /{ig-id}/media_publish (creation_id) publishes it
//   (https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media_publish).
//   These endpoints need the User token ("Access Tokens | User"), stored on INSTAGRAM accounts.
// - Instagram's limit: the publishing guide says 100 API posts per 24 hours, the media_publish and
//   content_publishing_limit references say 50
//   (https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit).
//   So we read quota_usage and config.quota_total instead of hard-coding either, and if that
//   read fails we publish anyway and let Meta enforce it.

const LEASE_MS = 10 * 60 * 1000;
const TICK_BUDGET_MS = 60 * 1000;
const MAX_POSTS_PER_TICK = 5;
const LATE_LIMIT_MS = 24 * 60 * 60 * 1000;
const CONTAINER_TIMEOUT_MS = 10 * 60 * 1000;
const CALENDAR_URL = "https://craftmyfunnel.live/content/calendar";

const PLATFORM_LABEL: Record<string, string> = {
    FACEBOOK_PAGE: "Facebook Page",
    INSTAGRAM: "Instagram",
    LINKEDIN_MEMBER: "LinkedIn profile",
    LINKEDIN_ORG: "LinkedIn page",
};

type Target = {
    id: string;
    status: string;
    containerId: string | null;
    updatedAt: Date;
    socialAccount: { platform: string; externalId: string; handle: string | null; status: string; scopes: string[]; encryptedToken: unknown };
};
type Post = { id: string; teamId: string; body: string; channelCaptions: unknown; mediaUrls: string[]; createdById: string | null; targets: Target[] };
type Outcome = "PUBLISHED" | "FAILED" | null;

const labelOf = (t: Target) => t.socialAccount.handle || PLATFORM_LABEL[t.socialAccount.platform] || "the account";
const unconfirmed = (t: Target) => `We couldn't confirm whether this posted to ${labelOf(t)}. Check it there before sending it again.`;
const messageOf = (error: unknown) => (error instanceof GraphError ? error.message : "Something went wrong while posting.");

function setTarget(id: string, from: string[], data: Record<string, unknown>) {
    return prisma.contentPostTarget.updateMany({ where: { id, status: { in: from } }, data });
}

function fail(t: Target, lastError: string) {
    return setTarget(t.id, ["PENDING", "SENDING"], { status: "FAILED", lastError });
}

// The one call that makes the post public. SENDING first, so a crash or timeout mid-call
// leaves a marker instead of a silent retry.
async function send(t: Target, call: () => Promise<string | null>) {
    const marked = await setTarget(t.id, ["PENDING"], { status: "SENDING" });
    if (marked.count !== 1) return;
    try {
        const externalId = await call();
        await setTarget(t.id, ["SENDING"], { status: "PUBLISHED", externalId, publishedAt: new Date(), lastError: null });
    } catch (error) {
        const uncertain = !(error instanceof GraphError) || error.uncertain;
        await setTarget(t.id, ["SENDING"], { status: "FAILED", lastError: uncertain ? unconfirmed(t) : messageOf(error) });
    }
}

const idOf = (json: any): string => {
    if (typeof json?.id !== "string") throw new GraphError("Meta didn't return an id.", false);
    return json.id;
};

async function publishToPage(post: Post, t: Target, token: string) {
    if (t.status === "SENDING") return fail(t, unconfirmed(t));
    const page = encodeURIComponent(t.socialAccount.externalId);
    const [first, ...rest] = post.mediaUrls;
    const text = captionFor(post, "FACEBOOK_PAGE");
    if (!first) return send(t, async () => idOf(await graphCall("POST", `${page}/feed`, { message: text }, token)));
    if (rest.length === 0) {
        return send(t, async () => {
            const json = await graphCall("POST", `${page}/photos`, { url: first, caption: text }, token);
            return typeof json?.post_id === "string" ? json.post_id : idOf(json);
        });
    }
    let attached: Record<string, string>;
    try {
        // Unpublished uploads: nothing is visible until the feed post below.
        const ids: string[] = [];
        for (const url of post.mediaUrls) ids.push(idOf(await graphCall("POST", `${page}/photos`, { url, published: "false" }, token)));
        attached = Object.fromEntries(ids.map((id, i) => [`attached_media[${i}]`, JSON.stringify({ media_fbid: id })]));
    } catch (error) {
        return fail(t, messageOf(error));
    }
    return send(t, async () => idOf(await graphCall("POST", `${page}/feed`, { message: text, ...attached }, token)));
}

async function instagramQuotaLeft(ig: string, token: string): Promise<number | null> {
    try {
        const json = await graphCall("GET", `${ig}/content_publishing_limit`, { fields: "quota_usage,config" }, token);
        const row = json?.data?.[0];
        const total = row?.config?.quota_total;
        const used = row?.quota_usage;
        return typeof total === "number" && typeof used === "number" ? Math.max(0, total - used) : null;
    } catch {
        return null; // advisory: Meta still enforces the limit at publish time
    }
}

async function createContainer(ig: string, post: Post, token: string): Promise<string> {
    const [first, ...rest] = post.mediaUrls;
    if (!first) throw new GraphError("Instagram posts need at least one image.", false);
    const caption = captionFor(post, "INSTAGRAM");
    if (rest.length === 0) return idOf(await graphCall("POST", `${ig}/media`, { image_url: first, caption }, token));
    const children: string[] = [];
    for (const url of post.mediaUrls) children.push(idOf(await graphCall("POST", `${ig}/media`, { image_url: url, is_carousel_item: "true" }, token)));
    return idOf(await graphCall("POST", `${ig}/media`, { media_type: "CAROUSEL", children: children.join(","), caption }, token));
}

async function containerStatus(containerId: string, token: string): Promise<string> {
    const json = await graphCall("GET", encodeURIComponent(containerId), { fields: "status_code" }, token);
    return typeof json?.status_code === "string" ? json.status_code : "UNKNOWN";
}

async function publishToInstagram(post: Post, t: Target, token: string, now: Date) {
    const ig = encodeURIComponent(t.socialAccount.externalId);
    const publish = (containerId: string) =>
        send(t, async () => idOf(await graphCall("POST", `${ig}/media_publish`, { creation_id: containerId }, token)));
    try {
        if (t.status === "SENDING") {
            // A publish call didn't finish last time. The container says whether it went out.
            if (!t.containerId) return fail(t, unconfirmed(t));
            const status = await containerStatus(t.containerId, token);
            if (status === "PUBLISHED") return setTarget(t.id, ["SENDING"], { status: "PUBLISHED", publishedAt: now, lastError: null });
            if (status !== "FINISHED") return fail(t, unconfirmed(t));
            const reset = await setTarget(t.id, ["SENDING"], { status: "PENDING" });
            if (reset.count !== 1) return;
            t = { ...t, status: "PENDING" };
            return publish(t.containerId as string);
        }

        let containerId = t.containerId;
        let createdAt = t.updatedAt;
        if (!containerId) {
            if ((await instagramQuotaLeft(ig, token)) === 0) {
                return fail(t, "This Instagram account has used up its daily posting limit. Send it again later.");
            }
            containerId = await createContainer(ig, post, token);
            const saved = await prisma.contentPostTarget.updateMany({ where: { id: t.id, status: "PENDING", containerId: null }, data: { containerId } });
            if (saved.count !== 1) return;
            createdAt = now;
        }

        const status = await containerStatus(containerId, token);
        if (status === "FINISHED") return publish(containerId);
        if (status === "PUBLISHED") return setTarget(t.id, ["PENDING"], { status: "PUBLISHED", publishedAt: now, lastError: null });
        if (status === "IN_PROGRESS") {
            if (now.getTime() - createdAt.getTime() > CONTAINER_TIMEOUT_MS) {
                return fail(t, "Instagram took too long to process the images. Send it again.");
            }
            return; // checked again next minute
        }
        return fail(t, status === "EXPIRED"
            ? "Instagram's upload expired before it was posted. Send it again."
            : "Instagram couldn't process the images. Check they're JPEGs between 4:5 and 1.91:1, then send it again.");
    } catch (error) {
        return fail(t, messageOf(error));
    }
}

async function publishTarget(post: Post, t: Target, now: Date) {
    const account = t.socialAccount;
    if (account.status !== "CONNECTED") return fail(t, `${labelOf(t)} needs reconnecting in Settings > Social accounts.`);
    const scope = PUBLISH_SCOPE[account.platform];
    if (!scope) return fail(t, `Posting to ${PLATFORM_LABEL[account.platform] ?? "this account"} isn't available yet.`);
    if (!account.scopes.includes(scope)) return fail(t, `${labelOf(t)} wasn't given permission to post. Reconnect it in Settings > Social accounts.`);
    const token = await decryptCredential(account.encryptedToken as EncryptedCredential).catch(() => undefined);
    if (!token) return fail(t, `${labelOf(t)} needs reconnecting in Settings > Social accounts.`);
    return account.platform === "FACEBOOK_PAGE" ? publishToPage(post, t, token) : publishToInstagram(post, t, token, now);
}

async function notifyAuthor(post: { teamId: string; createdById: string | null }) {
    if (!post.createdById) return;
    try {
        const { NotificationDispatcher } = await import("@/lib/notifications");
        // Plain text only: Meta's error text stays in the calendar, where it is escaped.
        await NotificationDispatcher.send(post.createdById, "SYSTEM", "A scheduled post didn't publish", `Open the content calendar to see what went wrong: ${CALENDAR_URL}`, { teamId: post.teamId });
    } catch (error) {
        console.error("[contentPublisher] failure notification failed", error instanceof Error ? error.message : error);
    }
}

async function finish(post: Pick<Post, "id" | "teamId" | "createdById">): Promise<Outcome> {
    const targets = await prisma.contentPostTarget.findMany({ where: { postId: post.id }, select: { status: true } });
    if (targets.some((t) => t.status === "PENDING" || t.status === "SENDING")) return null;
    const ok = targets.every((t) => t.status === "PUBLISHED");
    const moved = await prisma.contentPost.updateMany({ where: { id: post.id, status: "PUBLISHING" }, data: { status: ok ? "PUBLISHED" : "FAILED" } });
    if (moved.count !== 1) return null;
    if (!ok) await notifyAuthor(post);
    return ok ? "PUBLISHED" : "FAILED";
}

type Candidate = { id: string; teamId: string; status: string; scheduledAt: Date | null; approvalRequestId: string | null; createdById: string | null };

async function runPost(c: Candidate, now: Date, started: number): Promise<Outcome> {
    const { isCreatorFunnelEnabled } = await import("./featureGate");
    if (!(await isCreatorFunnelEnabled(c.teamId))) return null;

    const leaseFree = { OR: [{ publishLeaseUntil: null }, { publishLeaseUntil: { lt: now } }] };
    const leaseUntil = new Date(now.getTime() + LEASE_MS);

    if (c.status === "APPROVED") {
        const approval = c.approvalRequestId
            ? await prisma.approvalRequest.findFirst({
                  where: { id: c.approvalRequestId, teamId: c.teamId, entityType: CONTENT_POST_ENTITY, entityId: c.id, actionType: CONTENT_POST_ACTION, status: "APPROVED" },
                  select: { id: true },
              })
            : null;
        if (!approval) {
            console.warn(`[contentPublisher] post ${c.id} is APPROVED without an approved request; not publishing`);
            return null;
        }
        if (c.scheduledAt && now.getTime() - c.scheduledAt.getTime() > LATE_LIMIT_MS) {
            const late = await prisma.contentPost.updateMany({
                where: { id: c.id, status: "APPROVED", scheduledAt: c.scheduledAt },
                data: { status: "FAILED", reviewNote: "It missed its time by more than a day, so it wasn't posted. Pick a new time and send it again." },
            });
            if (late.count === 1) await notifyAuthor(c);
            return late.count === 1 ? "FAILED" : null;
        }
        const claimed = await prisma.contentPost.updateMany({
            where: { id: c.id, teamId: c.teamId, status: "APPROVED", approvalRequestId: c.approvalRequestId, scheduledAt: { lte: now }, ...leaseFree },
            data: { status: "PUBLISHING", publishLeaseUntil: leaseUntil, reviewNote: null },
        });
        if (claimed.count !== 1) return null;
        // A retry after a partial failure: only the accounts that didn't post go again.
        await prisma.contentPostTarget.updateMany({ where: { postId: c.id, status: "FAILED" }, data: { status: "PENDING", lastError: null, containerId: null } });
    } else {
        const leased = await prisma.contentPost.updateMany({ where: { id: c.id, status: "PUBLISHING", ...leaseFree }, data: { publishLeaseUntil: leaseUntil } });
        if (leased.count !== 1) return null;
    }

    try {
        const post = await prisma.contentPost.findFirst({
            where: { id: c.id },
            select: {
                id: true, teamId: true, body: true, channelCaptions: true, mediaUrls: true, createdById: true,
                targets: {
                    where: { status: { in: ["PENDING", "SENDING"] } },
                    select: {
                        id: true, status: true, containerId: true, updatedAt: true,
                        socialAccount: { select: { platform: true, externalId: true, handle: true, status: true, scopes: true, encryptedToken: true } },
                    },
                },
            },
        });
        if (!post) return null;
        for (const target of post.targets) {
            if (Date.now() - started > TICK_BUDGET_MS) break;
            await publishTarget(post, target, now);
        }
        return await finish(post);
    } finally {
        await prisma.contentPost.updateMany({ where: { id: c.id, publishLeaseUntil: leaseUntil }, data: { publishLeaseUntil: null } });
    }
}

export async function publishDuePosts(now = new Date()): Promise<{ published: number; failed: number }> {
    const started = Date.now();
    const result = { published: 0, failed: 0 };
    const candidates = await prisma.contentPost.findMany({
        where: {
            AND: [
                { OR: [{ publishLeaseUntil: null }, { publishLeaseUntil: { lt: now } }] },
                { OR: [{ status: "APPROVED", scheduledAt: { lte: now } }, { status: "PUBLISHING" }] },
            ],
        },
        select: { id: true, teamId: true, status: true, scheduledAt: true, approvalRequestId: true, createdById: true },
        orderBy: { scheduledAt: "asc" },
        take: MAX_POSTS_PER_TICK,
    });
    for (const candidate of candidates) {
        if (Date.now() - started > TICK_BUDGET_MS) break;
        try {
            const outcome = await runPost(candidate, now, started);
            if (outcome === "PUBLISHED") result.published++;
            if (outcome === "FAILED") result.failed++;
        } catch (error) {
            console.error(`[contentPublisher] post ${candidate.id} failed:`, error instanceof Error ? error.message : error);
        }
    }
    return result;
}
