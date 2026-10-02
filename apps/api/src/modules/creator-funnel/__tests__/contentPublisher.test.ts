import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory ContentPostTarget rows, so the tests check state transitions rather than call shapes.
type Row = { id: string; postId: string; status: string; containerId: string | null; updatedAt: Date; externalId?: string | null; lastError?: string | null; socialAccount: any };
const store = vi.hoisted(() => ({ targets: new Map<string, any>() }));

const matches = (row: any, where: any) =>
    Object.entries(where).every(([key, cond]: [string, any]) => {
        if (cond && typeof cond === "object" && "in" in cond) return cond.in.includes(row[key]);
        if (cond && typeof cond === "object" && "not" in cond) return row[key] !== cond.not;
        return row[key] === cond;
    });

const mockDb: any = vi.hoisted(() => ({
    contentPost: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    contentPostTarget: {
        updateMany: vi.fn(async ({ where, data }: any) => {
            let count = 0;
            for (const row of store.targets.values()) {
                if (matches(row, where)) {
                    Object.assign(row, data, { updatedAt: new Date() });
                    count++;
                }
            }
            return { count };
        }),
        findMany: vi.fn(async ({ where }: any) => [...store.targets.values()].filter((r) => matches(r, where)).map((r) => ({ status: r.status }))),
    },
    approvalRequest: { findFirst: vi.fn() },
}));
const graphCall = vi.hoisted(() => vi.fn());
const isCreatorFunnelEnabled = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: vi.fn(async (secret: any) => secret?.plain) }));
vi.mock("../featureGate", () => ({ isCreatorFunnelEnabled }));
vi.mock("@/lib/notifications", () => ({ NotificationDispatcher: { send } }));
vi.mock("../metaGraph", async (importOriginal) => ({ ...(await importOriginal<typeof import("../metaGraph")>()), graphCall }));

import { publishDuePosts } from "../contentPublisher";
import { GraphError } from "../metaGraph";

const NOW = new Date("2030-01-07T10:00:00Z");
const MIN = 60 * 1000;

const fbAccount = { platform: "FACEBOOK_PAGE", externalId: "page-1", handle: "Maker Page", status: "CONNECTED", scopes: ["pages_manage_posts"], encryptedToken: { plain: "page-token" } };
const igAccount = { platform: "INSTAGRAM", externalId: "ig-1", handle: "@maker", status: "CONNECTED", scopes: ["instagram_content_publish"], encryptedToken: { plain: "user-token" } };

function target(id: string, socialAccount: any, overrides: Partial<Row> = {}): Row {
    const row = { id, postId: "post-1", status: "PENDING", containerId: null, updatedAt: new Date(NOW.getTime() - MIN), socialAccount, ...overrides };
    store.targets.set(id, row);
    return row;
}

function due(overrides: any = {}, post: any = {}) {
    const candidate = { id: "post-1", teamId: "team-a", status: "APPROVED", scheduledAt: new Date(NOW.getTime() - MIN), approvalRequestId: "req-1", createdById: "user-1", ...overrides };
    mockDb.contentPost.findMany.mockResolvedValue([candidate]);
    mockDb.contentPost.findFirst.mockImplementation(async () => ({
        id: "post-1", teamId: "team-a", body: "Hello", mediaUrls: [], createdById: "user-1", ...post,
        targets: [...store.targets.values()].filter((r) => ["PENDING", "SENDING"].includes(r.status)).map((r) => ({ ...r })),
    }));
    return candidate;
}

const postUpdates = () => mockDb.contentPost.updateMany.mock.calls.map((c: any[]) => c[0]);
const finalStatus = () => postUpdates().find((u: any) => u.where.status === "PUBLISHING" && u.data.status)?.data.status;

describe("publishDuePosts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        store.targets.clear();
        isCreatorFunnelEnabled.mockResolvedValue(true);
        mockDb.approvalRequest.findFirst.mockResolvedValue({ id: "req-1" });
        mockDb.contentPost.updateMany.mockResolvedValue({ count: 1 });
    });

    describe("claiming", () => {
        it("claims only an approved, due post with an approved request and a free lease", async () => {
            target("t-fb", fbAccount);
            due();
            graphCall.mockResolvedValue({ id: "fb-post-1" });
            await publishDuePosts(NOW);

            expect(mockDb.approvalRequest.findFirst).toHaveBeenCalledWith({
                where: { id: "req-1", teamId: "team-a", entityType: "ContentPost", entityId: "post-1", actionType: "CONTENT_POST_PUBLISH", status: "APPROVED" },
                select: { id: true },
            });
            const claim = postUpdates()[0];
            expect(claim.where).toMatchObject({ id: "post-1", status: "APPROVED", approvalRequestId: "req-1", scheduledAt: { lte: NOW } });
            expect(claim.where.OR).toEqual([{ publishLeaseUntil: null }, { publishLeaseUntil: { lt: NOW } }]);
            expect(claim.data).toMatchObject({ status: "PUBLISHING", publishLeaseUntil: new Date(NOW.getTime() + 10 * MIN) });
            // the lease is released at the end
            expect(postUpdates().at(-1)).toEqual({ where: { id: "post-1", publishLeaseUntil: new Date(NOW.getTime() + 10 * MIN) }, data: { publishLeaseUntil: null } });
        });

        it("does nothing while the creator funnel is off or the request isn't approved", async () => {
            target("t-fb", fbAccount);
            due();
            isCreatorFunnelEnabled.mockResolvedValueOnce(false);
            await publishDuePosts(NOW);
            mockDb.approvalRequest.findFirst.mockResolvedValueOnce(null);
            await publishDuePosts(NOW);
            expect(mockDb.contentPost.updateMany).not.toHaveBeenCalled();
            expect(graphCall).not.toHaveBeenCalled();
        });

        it("posts nothing when the claim loses (moved to a later time, or the other VM has it)", async () => {
            target("t-fb", fbAccount);
            due();
            mockDb.contentPost.updateMany.mockResolvedValueOnce({ count: 0 });
            await publishDuePosts(NOW);
            expect(graphCall).not.toHaveBeenCalled();
        });

        it("fails a post that is more than a day late instead of posting it", async () => {
            target("t-fb", fbAccount);
            const late = new Date(NOW.getTime() - 25 * 60 * MIN);
            due({ scheduledAt: late });
            expect(await publishDuePosts(NOW)).toEqual({ published: 0, failed: 1 });
            expect(postUpdates()[0]).toEqual({
                where: { id: "post-1", status: "APPROVED", scheduledAt: late },
                data: { status: "FAILED", reviewNote: expect.stringMatching(/more than a day/) },
            });
            expect(graphCall).not.toHaveBeenCalled();
            expect(send).toHaveBeenCalledWith("user-1", "SYSTEM", "A scheduled post didn't publish", expect.stringContaining("/content/calendar"), { teamId: "team-a" });
        });

        it("retries only the accounts that failed last time", async () => {
            target("t-fb", fbAccount, { status: "FAILED", lastError: "boom" });
            target("t-ig", igAccount, { status: "PUBLISHED" });
            due();
            graphCall.mockResolvedValue({ id: "fb-post-2" });
            await publishDuePosts(NOW);

            expect(store.targets.get("t-ig")!.status).toBe("PUBLISHED");
            expect(store.targets.get("t-fb")).toMatchObject({ status: "PUBLISHED", externalId: "fb-post-2", lastError: null });
            expect(graphCall).toHaveBeenCalledTimes(1);
            expect(finalStatus()).toBe("PUBLISHED");
        });
    });

    describe("Facebook Pages", () => {
        it("posts text to the feed", async () => {
            target("t-fb", fbAccount);
            due();
            graphCall.mockResolvedValue({ id: "page-1_42" });
            expect(await publishDuePosts(NOW)).toEqual({ published: 1, failed: 0 });
            expect(graphCall).toHaveBeenCalledWith("POST", "page-1/feed", { message: "Hello" }, "page-token");
            expect(store.targets.get("t-fb")).toMatchObject({ status: "PUBLISHED", externalId: "page-1_42" });
        });

        it("posts one photo with its caption and keeps the post id", async () => {
            target("t-fb", fbAccount);
            due({}, { mediaUrls: ["https://cdn/a.jpg"] });
            graphCall.mockResolvedValue({ id: "photo-1", post_id: "page-1_7" });
            await publishDuePosts(NOW);
            expect(graphCall).toHaveBeenCalledWith("POST", "page-1/photos", { url: "https://cdn/a.jpg", caption: "Hello" }, "page-token");
            expect(store.targets.get("t-fb")!.externalId).toBe("page-1_7");
        });

        it("uploads several photos unpublished, then attaches them to one feed post", async () => {
            target("t-fb", fbAccount);
            due({}, { mediaUrls: ["https://cdn/a.jpg", "https://cdn/b.jpg"] });
            graphCall.mockResolvedValueOnce({ id: "p-a" }).mockResolvedValueOnce({ id: "p-b" }).mockResolvedValueOnce({ id: "page-1_9" });
            await publishDuePosts(NOW);
            expect(graphCall.mock.calls[0]).toEqual(["POST", "page-1/photos", { url: "https://cdn/a.jpg", published: "false" }, "page-token"]);
            expect(graphCall.mock.calls[2]).toEqual(["POST", "page-1/feed", {
                message: "Hello",
                "attached_media[0]": '{"media_fbid":"p-a"}',
                "attached_media[1]": '{"media_fbid":"p-b"}',
            }, "page-token"]);
            expect(store.targets.get("t-fb")!.status).toBe("PUBLISHED");
        });

        it("never re-sends a target left mid-call by a crash", async () => {
            target("t-fb", fbAccount, { status: "SENDING" });
            due({ status: "PUBLISHING" });
            expect(await publishDuePosts(NOW)).toEqual({ published: 0, failed: 1 });
            expect(graphCall).not.toHaveBeenCalled();
            expect(store.targets.get("t-fb")).toMatchObject({ status: "FAILED", lastError: expect.stringMatching(/couldn't confirm/) });
            expect(send).toHaveBeenCalled();
        });

        it("marks a timed-out publish call unconfirmed and a refused one with Meta's reason", async () => {
            target("t-fb", fbAccount);
            due();
            graphCall.mockRejectedValueOnce(new GraphError("Meta didn't answer in time.", true));
            await publishDuePosts(NOW);
            expect(store.targets.get("t-fb")!.lastError).toMatch(/couldn't confirm/);

            store.targets.clear();
            target("t-fb", fbAccount);
            graphCall.mockRejectedValueOnce(new GraphError("(#200) Permissions error", false));
            await publishDuePosts(NOW);
            expect(store.targets.get("t-fb")).toMatchObject({ status: "FAILED", lastError: "(#200) Permissions error" });
        });

        it("fails without calling Meta when the account lacks posting permission or needs reconnecting", async () => {
            target("t-fb", { ...fbAccount, scopes: [] });
            target("t-ig", { ...igAccount, status: "NEEDS_RECONNECT" });
            due();
            await publishDuePosts(NOW);
            expect(graphCall).not.toHaveBeenCalled();
            expect(store.targets.get("t-fb")!.lastError).toMatch(/permission to post/);
            expect(store.targets.get("t-ig")!.lastError).toMatch(/needs reconnecting/);
            expect(finalStatus()).toBe("FAILED");
        });
    });

    describe("Instagram", () => {
        const routes = (handlers: Record<string, (params: any) => any>) =>
            graphCall.mockImplementation(async (_method: string, path: string, params: any) => {
                const handler = handlers[path];
                if (!handler) throw new Error(`unexpected ${path}`);
                return handler(params);
            });

        it("publishes a finished container with the User token", async () => {
            target("t-ig", igAccount);
            due({}, { mediaUrls: ["https://cdn/a.jpg"] });
            routes({
                "ig-1/content_publishing_limit": () => ({ data: [{ quota_usage: 3, config: { quota_total: 50, quota_duration: 86400 } }] }),
                "ig-1/media": () => ({ id: "c-1" }),
                "c-1": () => ({ status_code: "FINISHED" }),
                "ig-1/media_publish": () => ({ id: "ig-media-1" }),
            });
            expect(await publishDuePosts(NOW)).toEqual({ published: 1, failed: 0 });
            expect(graphCall).toHaveBeenCalledWith("POST", "ig-1/media", { image_url: "https://cdn/a.jpg", caption: "Hello" }, "user-token");
            expect(graphCall).toHaveBeenCalledWith("POST", "ig-1/media_publish", { creation_id: "c-1" }, "user-token");
            expect(store.targets.get("t-ig")).toMatchObject({ status: "PUBLISHED", externalId: "ig-media-1", containerId: "c-1" });
        });

        it("uses the post's Instagram caption on Instagram and the body on Facebook", async () => {
            target("t-ig", igAccount);
            target("t-fb", fbAccount);
            due({}, { mediaUrls: ["https://cdn/a.jpg"], channelCaptions: { INSTAGRAM: "IG words #tag", LINKEDIN: "LI words" } });
            routes({
                "ig-1/content_publishing_limit": () => ({ data: [{ quota_usage: 0, config: { quota_total: 50 } }] }),
                "ig-1/media": () => ({ id: "c-1" }),
                "c-1": () => ({ status_code: "FINISHED" }),
                "ig-1/media_publish": () => ({ id: "ig-media-1" }),
                "page-1/photos": () => ({ id: "photo-1", post_id: "page-1_7" }),
            });
            await publishDuePosts(NOW);
            expect(graphCall).toHaveBeenCalledWith("POST", "ig-1/media", { image_url: "https://cdn/a.jpg", caption: "IG words #tag" }, "user-token");
            expect(graphCall).toHaveBeenCalledWith("POST", "page-1/photos", { url: "https://cdn/a.jpg", caption: "Hello" }, "page-token");
        });

        it("builds a carousel from child containers", async () => {
            target("t-ig", igAccount);
            due({}, { mediaUrls: ["https://cdn/a.jpg", "https://cdn/b.jpg"] });
            let n = 0;
            routes({
                "ig-1/content_publishing_limit": () => { throw new GraphError("nope", false); }, // unreadable: publish anyway
                "ig-1/media": (p) => ({ id: p.media_type === "CAROUSEL" ? "carousel" : `child-${++n}` }),
                carousel: () => ({ status_code: "FINISHED" }),
                "ig-1/media_publish": () => ({ id: "ig-media-2" }),
            });
            await publishDuePosts(NOW);
            expect(graphCall).toHaveBeenCalledWith("POST", "ig-1/media", { image_url: "https://cdn/a.jpg", is_carousel_item: "true" }, "user-token");
            expect(graphCall).toHaveBeenCalledWith("POST", "ig-1/media", { media_type: "CAROUSEL", children: "child-1,child-2", caption: "Hello" }, "user-token");
            expect(store.targets.get("t-ig")!.status).toBe("PUBLISHED");
        });

        it("waits for a container that is still processing, then publishes it next minute", async () => {
            target("t-ig", igAccount);
            due({}, { mediaUrls: ["https://cdn/a.jpg"] });
            let status = "IN_PROGRESS";
            routes({
                "ig-1/content_publishing_limit": () => ({ data: [{ quota_usage: 0, config: { quota_total: 50 } }] }),
                "ig-1/media": () => ({ id: "c-1" }),
                "c-1": () => ({ status_code: status }),
                "ig-1/media_publish": () => ({ id: "ig-media-3" }),
            });
            expect(await publishDuePosts(NOW)).toEqual({ published: 0, failed: 0 });
            expect(store.targets.get("t-ig")).toMatchObject({ status: "PENDING", containerId: "c-1" });
            expect(finalStatus()).toBeUndefined(); // still PUBLISHING

            status = "FINISHED";
            due({ status: "PUBLISHING" }, { mediaUrls: ["https://cdn/a.jpg"] });
            graphCall.mockClear();
            expect(await publishDuePosts(new Date(NOW.getTime() + MIN))).toEqual({ published: 1, failed: 0 });
            expect(graphCall.mock.calls.map((c: any[]) => c[1])).toEqual(["c-1", "ig-1/media_publish"]); // no second container
        });

        it("gives up on a container still processing after 10 minutes", async () => {
            target("t-ig", igAccount, { containerId: "c-1", updatedAt: new Date(NOW.getTime() - 11 * MIN) });
            due({ status: "PUBLISHING" });
            routes({ "c-1": () => ({ status_code: "IN_PROGRESS" }) });
            await publishDuePosts(NOW);
            expect(store.targets.get("t-ig")).toMatchObject({ status: "FAILED", lastError: expect.stringMatching(/too long/) });
        });

        it("after a crash mid-publish, asks the container instead of posting twice", async () => {
            target("t-ig", igAccount, { status: "SENDING", containerId: "c-1" });
            due({ status: "PUBLISHING" });
            routes({ "c-1": () => ({ status_code: "PUBLISHED" }) });
            await publishDuePosts(NOW);
            expect(store.targets.get("t-ig")!.status).toBe("PUBLISHED");
            expect(graphCall).toHaveBeenCalledTimes(1);

            store.targets.clear();
            graphCall.mockReset();
            target("t-ig", igAccount, { status: "SENDING", containerId: "c-2" });
            routes({ "c-2": () => ({ status_code: "FINISHED" }), "ig-1/media_publish": () => ({ id: "ig-media-4" }) });
            await publishDuePosts(NOW);
            expect(store.targets.get("t-ig")).toMatchObject({ status: "PUBLISHED", externalId: "ig-media-4" });

            store.targets.clear();
            graphCall.mockReset();
            target("t-ig", igAccount, { status: "SENDING", containerId: "c-3" });
            routes({ "c-3": () => ({ status_code: "ERROR" }) });
            await publishDuePosts(NOW);
            expect(store.targets.get("t-ig")).toMatchObject({ status: "FAILED", lastError: expect.stringMatching(/couldn't confirm/) });
        });

        it("stops before creating anything when the daily limit is used up", async () => {
            target("t-ig", igAccount);
            due({}, { mediaUrls: ["https://cdn/a.jpg"] });
            routes({ "ig-1/content_publishing_limit": () => ({ data: [{ quota_usage: 50, config: { quota_total: 50 } }] }) });
            await publishDuePosts(NOW);
            expect(graphCall).toHaveBeenCalledTimes(1);
            expect(store.targets.get("t-ig")).toMatchObject({ status: "FAILED", lastError: expect.stringMatching(/daily posting limit/) });
        });
    });
});
