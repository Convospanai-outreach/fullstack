import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    contentPost: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    contentPostTarget: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    approvalRequest: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    socialAccount: { count: vi.fn() },
    featureFlag: { findUnique: vi.fn() },
    team: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/overseer/breakerService", () => ({ getBreakerState: vi.fn(async () => "CLOSED") }));

import {
    ContentPostError,
    createPost,
    decideContentPost,
    deletePost,
    getStageMix,
    instagramProblems,
    isOwnMediaUrl,
    submitPost,
    updatePost,
} from "../contentPostService";

const TEAM = "team-a";
const HOUR = 60 * 60 * 1000;
const media = (team = TEAM) => `https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/content-media/${team}/0b6c2d9e-1f0a-4c3b-9d8e-7a6b5c4d3e2f.jpg`;

const post = (overrides: any = {}) => ({
    id: "post-1",
    teamId: TEAM,
    body: "Hello",
    mediaUrls: [media()],
    funnelStage: "TOFU",
    status: "DRAFT",
    scheduledAt: new Date(Date.now() + 48 * HOUR),
    timezone: "Asia/Kolkata",
    approvalRequestId: null,
    updatedAt: new Date("2026-09-30T00:00:00Z"),
    targets: [{ socialAccountId: "acc-ig", status: "PENDING" }],
    ...overrides,
});

const expectError = async (promise: Promise<unknown>, status: number) => {
    const error = await promise.catch((e) => e);
    expect(error).toBeInstanceOf(ContentPostError);
    expect(error.status).toBe(status);
    return error as ContentPostError;
};

describe("contentPostService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env["SUPABASE_URL"];
        mockDb.$transaction.mockImplementation((fn: any) => fn(mockDb));
        mockDb.contentPost.updateMany.mockResolvedValue({ count: 1 });
        mockDb.contentPost.deleteMany.mockResolvedValue({ count: 1 });
        mockDb.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
        mockDb.approvalRequest.create.mockResolvedValue({ id: "req-1" });
        mockDb.contentPostTarget.findMany.mockResolvedValue([{ socialAccount: { platform: "INSTAGRAM" } }]);
        mockDb.socialAccount.count.mockResolvedValue(1);
    });

    afterEach(() => {
        delete process.env["SUPABASE_URL"];
    });

    describe("instagramProblems", () => {
        it("needs an image and enforces caption, hashtag and tag limits", () => {
            expect(instagramProblems("hi", [])).toEqual(["Instagram posts need at least one image."]);
            expect(instagramProblems("hi", [media()])).toEqual([]);
            expect(instagramProblems("x".repeat(2201), [media()])).toHaveLength(1);
            const tags = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(" ");
            expect(instagramProblems(tags, [media()])[0]).toMatch(/30 hashtags/);
            const mentions = Array.from({ length: 21 }, (_, i) => `@user${i}`).join(" ");
            expect(instagramProblems(mentions, [media()])[0]).toMatch(/20 @ tags/);
            expect(instagramProblems("hi", Array(11).fill(media()))[0]).toMatch(/at most 10 images/);
        });
    });

    describe("isOwnMediaUrl", () => {
        it("accepts only JPEGs in this team's folder of the content-media bucket", () => {
            expect(isOwnMediaUrl(media(), TEAM)).toBe(true);
            expect(isOwnMediaUrl(media("team-b"), TEAM)).toBe(false);
            expect(isOwnMediaUrl(media().replace("content-media", "branding"), TEAM)).toBe(false);
            expect(isOwnMediaUrl(`${media()}?x=1`, TEAM)).toBe(false);
            expect(isOwnMediaUrl(media().replace("abcdefghijklmnopqrst.supabase.co", "evil.example.com"), TEAM)).toBe(false);
            expect(isOwnMediaUrl(media().replace("https:", "http:"), TEAM)).toBe(false);
            expect(isOwnMediaUrl("not a url", TEAM)).toBe(false);
        });

        it("pins the host to SUPABASE_URL when it is set", () => {
            process.env["SUPABASE_URL"] = "https://zzzzzzzzzzzzzzzzzzzz.supabase.co";
            expect(isOwnMediaUrl(media(), TEAM)).toBe(false);
            expect(isOwnMediaUrl(media().replace("abcdefghijklmnopqrst", "zzzzzzzzzzzzzzzzzzzz"), TEAM)).toBe(true);
        });
    });

    describe("createPost", () => {
        const input = { body: "Hi", funnelStage: "TOFU" as const, mediaUrls: [media()], scheduledAt: null, timezone: null, accountIds: ["acc-ig"] };

        it("rejects accounts from another workspace", async () => {
            mockDb.socialAccount.count.mockResolvedValue(0);
            await expectError(createPost(TEAM, "user-1", input), 400);
            expect(mockDb.socialAccount.count).toHaveBeenCalledWith({ where: { teamId: TEAM, id: { in: ["acc-ig"] }, status: { not: "DISCONNECTED" } } });
            expect(mockDb.contentPost.create).not.toHaveBeenCalled();
        });

        it("rejects media that isn't an upload of this team", async () => {
            await expectError(createPost(TEAM, "user-1", { ...input, mediaUrls: [media("team-b")] }), 400);
        });

        it("rejects a time in the past", async () => {
            await expectError(createPost(TEAM, "user-1", { ...input, scheduledAt: new Date(Date.now() - HOUR) }), 400);
        });

        it("creates a draft with one target per account", async () => {
            mockDb.contentPost.create.mockResolvedValue({ id: "post-1" });
            await createPost(TEAM, "user-1", { ...input, accountIds: ["acc-ig", "acc-ig"] });
            const data = mockDb.contentPost.create.mock.calls[0][0].data;
            expect(data).toMatchObject({ teamId: TEAM, createdById: "user-1", body: "Hi", funnelStage: "TOFU" });
            expect(data.targets.create).toEqual([{ socialAccountId: "acc-ig" }]);
        });
    });

    describe("updatePost", () => {
        it("sends an approved post back to draft when its text changes, and withdraws the pending approval", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(post({ status: "APPROVED", approvalRequestId: "req-1" }));
            await updatePost(TEAM, "post-1", { body: "Changed" });

            const update = mockDb.contentPost.updateMany.mock.calls[0][0];
            expect(update.where).toMatchObject({ id: "post-1", teamId: TEAM });
            expect(update.data).toMatchObject({ body: "Changed", status: "DRAFT", approvalRequestId: null });
            expect(mockDb.approvalRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: "req-1", teamId: TEAM, status: "PENDING" },
            }));
        });

        it("treats a changed channel caption on an approved post as an edit, but not a changed visual brief", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(post({ status: "APPROVED", approvalRequestId: "req-1", channelCaptions: { INSTAGRAM: "Old" } }));
            await updatePost(TEAM, "post-1", { channelCaptions: { INSTAGRAM: "New" } });
            expect(mockDb.contentPost.updateMany.mock.calls[0][0].data).toMatchObject({ channelCaptions: { INSTAGRAM: "New" }, status: "DRAFT" });

            vi.clearAllMocks();
            mockDb.$transaction.mockImplementation((fn: any) => fn(mockDb));
            mockDb.contentPost.updateMany.mockResolvedValue({ count: 1 });
            mockDb.contentPost.findFirst.mockResolvedValue(post({ status: "APPROVED", approvalRequestId: "req-1", channelCaptions: { INSTAGRAM: "Same" } }));
            await updatePost(TEAM, "post-1", { channelCaptions: { INSTAGRAM: "Same" }, visualBrief: "A new photo idea" });
            const data = mockDb.contentPost.updateMany.mock.calls[0][0].data;
            expect(data.status).toBeUndefined();
            expect(data.visualBrief).toBe("A new photo idea");
            expect(mockDb.approvalRequest.updateMany).not.toHaveBeenCalled();
        });

        it("treats adding an account to an approved post as an edit", async () => {
            mockDb.socialAccount.count.mockResolvedValue(2);
            mockDb.contentPost.findFirst.mockResolvedValue(post({ status: "APPROVED", approvalRequestId: "req-1" }));
            await updatePost(TEAM, "post-1", { accountIds: ["acc-ig", "acc-fb"] });

            expect(mockDb.contentPost.updateMany.mock.calls[0][0].data.status).toBe("DRAFT");
            expect(mockDb.contentPostTarget.createMany).toHaveBeenCalledWith({
                data: [{ postId: "post-1", socialAccountId: "acc-ig" }, { postId: "post-1", socialAccountId: "acc-fb" }],
                skipDuplicates: true,
            });
        });

        it("keeps the approval when an approved post only moves to another time", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(post({ status: "APPROVED", approvalRequestId: "req-1" }));
            const at = new Date(Date.now() + 72 * HOUR);
            await updatePost(TEAM, "post-1", { scheduledAt: at, timezone: "Asia/Kolkata" });

            const data = mockDb.contentPost.updateMany.mock.calls[0][0].data;
            expect(data.scheduledAt).toBe(at);
            expect(data.status).toBeUndefined();
            expect(mockDb.approvalRequest.updateMany).not.toHaveBeenCalled();
        });

        it("updates the pending approval card's time when a post in review moves", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(post({ status: "IN_REVIEW", approvalRequestId: "req-1" }));
            mockDb.approvalRequest.findFirst.mockResolvedValue({ payload: { subject: "old", body: "Hello" } });
            await updatePost(TEAM, "post-1", { scheduledAt: new Date("2030-01-07T04:30:00Z"), timezone: "Asia/Kolkata" });

            const payload = mockDb.approvalRequest.updateMany.mock.calls[0][0].data.payload;
            expect(payload.body).toBe("Hello");
            expect(payload.subject).toBe("Instagram post, Mon, 7 Jan 2030, 10:00 (Asia/Kolkata)");
        });

        it("refuses to move a post into the past and to edit a published post", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(post());
            await expectError(updatePost(TEAM, "post-1", { scheduledAt: new Date(Date.now() - HOUR) }), 400);
            mockDb.contentPost.findFirst.mockResolvedValue(post({ status: "PUBLISHED" }));
            await expectError(updatePost(TEAM, "post-1", { body: "x" }), 409);
        });

        it("never drops an account the post is already live on", async () => {
            mockDb.socialAccount.count.mockResolvedValue(1);
            mockDb.contentPost.findFirst.mockResolvedValue(post({ status: "FAILED", targets: [{ socialAccountId: "acc-ig", status: "PUBLISHED" }, { socialAccountId: "acc-fb", status: "FAILED" }] }));
            await expectError(updatePost(TEAM, "post-1", { accountIds: ["acc-fb"] }), 409);
            expect(mockDb.contentPost.updateMany).not.toHaveBeenCalled();
        });

        it("reports a concurrent change instead of overwriting it", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(post());
            mockDb.contentPost.updateMany.mockResolvedValue({ count: 0 });
            await expectError(updatePost(TEAM, "post-1", { body: "x" }), 409);
        });
    });

    describe("submitPost", () => {
        const ig = (overrides: any = {}) => ({
            status: "PENDING",
            socialAccount: { platform: "INSTAGRAM", handle: "@maker", status: "CONNECTED", scopes: ["instagram_content_publish"], ...overrides },
        });
        const fb = (status = "PENDING") => ({
            status,
            socialAccount: { platform: "FACEBOOK_PAGE", handle: "Maker Page", status: "CONNECTED", scopes: ["pages_manage_posts"] },
        });
        const submittable = (overrides: any = {}) => post({ targets: [ig()], ...overrides });

        it("checks Instagram's rules before it goes to review", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ mediaUrls: [] }));
            const error = await expectError(submitPost(TEAM, "post-1", "user-1"), 400);
            expect(error.message).toMatch(/at least one image/);
            expect(mockDb.approvalRequest.create).not.toHaveBeenCalled();
        });

        it("needs a future time, an account, and connected accounts", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ scheduledAt: new Date(Date.now() - HOUR) }));
            await expectError(submitPost(TEAM, "post-1", "user-1"), 400);
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ targets: [] }));
            await expectError(submitPost(TEAM, "post-1", "user-1"), 400);
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ targets: [ig({ status: "NEEDS_RECONNECT" })] }));
            await expectError(submitPost(TEAM, "post-1", "user-1"), 400);
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ status: "IN_REVIEW" }));
            await expectError(submitPost(TEAM, "post-1", "user-1"), 409);
        });

        it("checks Instagram's rules against the Instagram caption, and shows each channel's text on the approval card", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ channelCaptions: { INSTAGRAM: "x".repeat(2201) } }));
            const error = await expectError(submitPost(TEAM, "post-1", "user-1"), 400);
            expect(error.message).toMatch(/2200 characters/);

            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ targets: [ig(), fb()], channelCaptions: { INSTAGRAM: "Insta text", LINKEDIN: "Not posted" } }));
            mockDb.contentPostTarget.findMany.mockResolvedValue([]);
            await submitPost(TEAM, "post-1", "user-1");
            expect(mockDb.approvalRequest.create.mock.calls[0][0].data.payload.body).toBe("Instagram:\nInsta text\n\nFacebook Page:\nHello");
        });

        it("needs the account to have granted posting permission", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ targets: [ig({ scopes: ["instagram_basic"] })] }));
            const error = await expectError(submitPost(TEAM, "post-1", "user-1"), 400);
            expect(error.message).toMatch(/permission to post/);
        });

        it("checks LinkedIn's limits against the LinkedIn caption, and page posts against the platform switch", async () => {
            const liTarget = (platform: string, scopes: string[]) => ({ status: "PENDING", socialAccount: { platform, handle: "Maker", status: "CONNECTED", scopes } });
            const profile = liTarget("LINKEDIN_MEMBER", ["openid", "w_member_social"]);
            const page = liTarget("LINKEDIN_ORG", ["w_organization_social"]);

            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ targets: [profile], mediaUrls: [], channelCaptions: { LINKEDIN: "x".repeat(3001) } }));
            expect((await expectError(submitPost(TEAM, "post-1", "user-1"), 400)).message).toMatch(/3000 characters/);
            // 2000 characters as typed, but each "(" goes out as "\(" - over the limit as sent.
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ targets: [profile], mediaUrls: [], channelCaptions: { LINKEDIN: "(".repeat(2000) } }));
            expect((await expectError(submitPost(TEAM, "post-1", "user-1"), 400)).message).toMatch(/3000 characters/);
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ targets: [profile], mediaUrls: Array(21).fill(media()) }));
            expect((await expectError(submitPost(TEAM, "post-1", "user-1"), 400)).message).toMatch(/at most 20 images/);
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ targets: [liTarget("LINKEDIN_MEMBER", ["openid", "profile"])], mediaUrls: [] }));
            expect((await expectError(submitPost(TEAM, "post-1", "user-1"), 400)).message).toMatch(/permission to post/);

            mockDb.featureFlag.findUnique.mockResolvedValue(null);
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ targets: [page], mediaUrls: [] }));
            expect((await expectError(submitPost(TEAM, "post-1", "user-1"), 400)).message).toMatch(/LinkedIn pages is switched off/);
            expect(mockDb.featureFlag.findUnique).toHaveBeenCalledWith({ where: { key: "linkedin_pages" }, select: { isEnabled: true } });
            expect(mockDb.approvalRequest.create).not.toHaveBeenCalled();
        });

        it("on a retry, only lists and checks the accounts it didn't reach", async () => {
            // Live on Instagram already; only the Facebook Page is left, so no Instagram image rule applies.
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ status: "FAILED", mediaUrls: [], targets: [ig(), fb()].map((t, i) => (i === 0 ? { ...t, status: "PUBLISHED" } : t)) }));
            mockDb.contentPostTarget.findMany.mockResolvedValue([{ socialAccount: { platform: "FACEBOOK_PAGE" } }]);
            await submitPost(TEAM, "post-1", "user-1");

            const request = mockDb.approvalRequest.create.mock.calls[0][0].data;
            expect(request.payload.recipient).toBe("Maker Page (Facebook Page)");
            expect(request.payload.subject).toMatch(/^Facebook Page post, /);
            expect(mockDb.contentPostTarget.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { postId: "post-1", status: { not: "PUBLISHED" } } }));
        });

        it("has nothing to send once every account has it", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(submittable({ status: "FAILED", targets: [{ ...ig(), status: "PUBLISHED" }] }));
            const error = await expectError(submitPost(TEAM, "post-1", "user-1"), 400);
            expect(error.message).toMatch(/already live/);
        });

        it("creates a fresh approval and moves the post to review", async () => {
            mockDb.contentPost.findFirst.mockResolvedValue(submittable());
            expect(await submitPost(TEAM, "post-1", "user-1")).toEqual({ approvalRequestId: "req-1" });

            const request = mockDb.approvalRequest.create.mock.calls[0][0].data;
            expect(request).toMatchObject({
                teamId: TEAM,
                requesterId: "user-1",
                actionType: "CONTENT_POST_PUBLISH",
                entityType: "ContentPost",
                entityId: "post-1",
                status: "PENDING",
                tier: "QUEUED",
            });
            expect(request.payload).toMatchObject({ recipient: "@maker (Instagram)", body: "Hello", mediaUrls: [media()] });
            expect(request.payload.subject).toMatch(/^Instagram post, /);
            expect(mockDb.contentPost.updateMany).toHaveBeenCalledWith({
                where: { id: "post-1", teamId: TEAM, updatedAt: expect.any(Date), status: { in: ["DRAFT", "FAILED"] } },
                data: { status: "IN_REVIEW", approvalRequestId: "req-1", reviewNote: null },
            });
        });
    });

    describe("decideContentPost", () => {
        it("approves only a pending request and only the post it is attached to, if its time is still ahead", async () => {
            expect(await decideContentPost(TEAM, "req-1", "user-2", "APPROVED")).toBe(true);
            expect(mockDb.approvalRequest.updateMany.mock.calls[0][0].where).toEqual({ id: "req-1", teamId: TEAM, status: "PENDING", actionType: "CONTENT_POST_PUBLISH" });
            expect(mockDb.approvalRequest.updateMany.mock.calls[0][0].data.reviewerId).toBe("user-2");
            expect(mockDb.contentPost.updateMany).toHaveBeenCalledTimes(1);
            expect(mockDb.contentPost.updateMany.mock.calls[0][0]).toEqual({
                where: { teamId: TEAM, status: "IN_REVIEW", approvalRequestId: "req-1", scheduledAt: { gt: expect.any(Date) } },
                data: { status: "APPROVED" },
            });
        });

        it("changes nothing for a stale or already-decided request", async () => {
            mockDb.approvalRequest.updateMany.mockResolvedValue({ count: 0 });
            expect(await decideContentPost(TEAM, "req-1", "user-2", "APPROVED")).toBe(false);
            expect(mockDb.contentPost.updateMany).not.toHaveBeenCalled();
        });

        it("sends the post back to draft when approval comes after its time", async () => {
            mockDb.contentPost.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
            await decideContentPost(TEAM, "req-1", "user-2", "APPROVED");
            expect(mockDb.contentPost.updateMany.mock.calls[1][0].data).toMatchObject({ status: "DRAFT", approvalRequestId: null, reviewNote: expect.stringMatching(/time passed/) });
        });

        it("returns a rejected post to draft with the reviewer's note", async () => {
            await decideContentPost(TEAM, "req-1", "user-2", "REJECTED", "Wrong link");
            expect(mockDb.contentPost.updateMany.mock.calls[0][0].data).toEqual({ status: "DRAFT", approvalRequestId: null, reviewNote: "Not approved: Wrong link" });
        });

        it("doesn't write the auto-deny sweep's pseudo reviewer into the User FK", async () => {
            await decideContentPost(TEAM, "req-1", "system-timeout", "REJECTED", "Auto-denied");
            expect(mockDb.approvalRequest.updateMany.mock.calls[0][0].data.reviewerId).toBeUndefined();
            expect(mockDb.contentPost.updateMany.mock.calls[0][0].data.reviewNote).toBe("Nobody reviewed it in time. Send it again.");
        });
    });

    it("won't delete a post that is partly live", async () => {
        mockDb.contentPost.findFirst.mockResolvedValue(post({ status: "FAILED", targets: [{ socialAccountId: "acc-ig", status: "PUBLISHED" }] }));
        await expectError(deletePost(TEAM, "post-1"), 409);
        expect(mockDb.contentPost.deleteMany).not.toHaveBeenCalled();
    });

    it("falls back to the 60/30/10/0 stage mix", async () => {
        mockDb.team.findUnique.mockResolvedValue({ contentStageMix: null });
        expect(await getStageMix(TEAM)).toEqual({ TOFU: 60, MOFU: 30, BOFU: 10, POST: 0 });
        mockDb.team.findUnique.mockResolvedValue({ contentStageMix: { TOFU: 50, MOFU: 30, BOFU: 15, POST: 5 } });
        expect(await getStageMix(TEAM)).toEqual({ TOFU: 50, MOFU: 30, BOFU: 15, POST: 5 });
    });
});
