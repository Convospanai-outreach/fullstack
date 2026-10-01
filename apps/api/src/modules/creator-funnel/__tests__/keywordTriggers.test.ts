import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory KeywordTriggerReply rows, so the tests check the claim/status transitions rather
// than call shapes.
const store = vi.hoisted(() => ({ rows: new Map<string, any>(), seq: 0 }));
const matches = (row: any, where: any): boolean =>
    Object.entries(where).every(([key, cond]: [string, any]) => {
        if (key === "OR") return cond.some((c: any) => matches(row, c));
        if (cond && typeof cond === "object" && "in" in cond) return cond.in.includes(row[key]);
        if (cond && typeof cond === "object" && "notIn" in cond) return !cond.notIn.includes(row[key]);
        if (cond && typeof cond === "object" && "gte" in cond) return row[key] >= cond.gte;
        return row[key] === cond;
    });

const mockDb: any = vi.hoisted(() => ({
    keywordTrigger: { findMany: vi.fn() },
    keywordTriggerReply: {
        count: vi.fn(),
        groupBy: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
    },
    landingPage: { findFirst: vi.fn() },
    message: { create: vi.fn() },
}));
const graphCall = vi.hoisted(() => vi.fn());
const graphPostJson = vi.hoisted(() => vi.fn());
const isCreatorFunnelEnabled = vi.hoisted(() => vi.fn());
const findOrCreateContact = vi.hoisted(() => vi.fn());
const pageTokenFor = vi.hoisted(() => vi.fn());
const applyFunnelEvent = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: vi.fn(async (secret: any) => secret?.plain) }));
vi.mock("../featureGate", () => ({ isCreatorFunnelEnabled }));
vi.mock("../funnelStageService", () => ({ applyFunnelEvent }));
vi.mock("../socialInbox", async (importOriginal) => ({ ...(await importOriginal<typeof import("../socialInbox")>()), findOrCreateContact, pageTokenFor }));
vi.mock("../metaGraph", async (importOriginal) => ({ ...(await importOriginal<typeof import("../metaGraph")>()), graphCall, graphPostJson }));

import {
    ACCOUNT_HOURLY_LIMIT,
    extractCommentEvents,
    matchesKeyword,
    queueCommentReplies,
    queueDmReply,
    sendPendingAutoReplies,
} from "../keywordTriggers";
import { GraphError } from "../metaGraph";

const NOW = new Date("2030-01-07T10:00:00Z");
const HOUR = 60 * 60 * 1000;
const account = { id: "acc-ig", teamId: "team-a", platform: "INSTAGRAM" as const };

describe("matchesKeyword", () => {
    it("matches whole words, ignoring case and punctuation", () => {
        expect(matchesKeyword("GUIDE!!", ["guide"], "EXACT")).toBe(true);
        expect(matchesKeyword("guide please", ["guide"], "EXACT")).toBe(false);
        expect(matchesKeyword("can I get the Guide pls", ["guide"], "CONTAINS")).toBe(true);
        expect(matchesKeyword("my guidebook", ["guide"], "CONTAINS")).toBe(false);
        expect(matchesKeyword("send the free guide", ["free guide"], "CONTAINS")).toBe(true);
        expect(matchesKeyword("free the guide", ["free guide"], "CONTAINS")).toBe(false);
        expect(matchesKeyword("¡Guía!", ["guía"], "EXACT")).toBe(true);
        expect(matchesKeyword("anything", ["!!"], "CONTAINS")).toBe(false);
    });
});

describe("extractCommentEvents", () => {
    it("reads Instagram comments and Facebook comment adds, and skips the account's own comments", () => {
        const ig = extractCommentEvents({
            object: "instagram",
            entry: [
                {
                    id: "ig-1",
                    changes: [
                        { field: "comments", value: { id: "c1", text: "GUIDE", from: { id: "u9", username: "asha" }, media: { id: "m1" } } },
                        { field: "comments", value: { id: "c2", text: "GUIDE", from: { id: "ig-1", username: "us" }, media: { id: "m1" } } },
                        { field: "mentions", value: { id: "c3" } },
                    ],
                },
            ],
        });
        expect(ig).toEqual([
            { platform: "INSTAGRAM", accountExternalId: "ig-1", commentId: "c1", authorId: "u9", authorHandle: "@asha", authorName: null, text: "GUIDE", objectId: "m1" },
        ]);

        const fb = extractCommentEvents({
            object: "page",
            entry: [
                {
                    id: "page-1",
                    changes: [
                        { field: "feed", value: { item: "comment", verb: "add", comment_id: "p_c1", post_id: "page-1_44", from: { id: "u2", name: "Ravi K" }, message: "guide" } },
                        { field: "feed", value: { item: "comment", verb: "edited", comment_id: "p_c2", from: { id: "u2" }, message: "guide" } },
                        { field: "feed", value: { item: "reaction", verb: "add", from: { id: "u2" } } },
                        { field: "feed", value: { item: "comment", verb: "add", comment_id: "p_c3", from: { id: "page-1" }, message: "guide" } },
                    ],
                },
            ],
        });
        expect(fb).toEqual([
            { platform: "FACEBOOK_PAGE", accountExternalId: "page-1", commentId: "p_c1", authorId: "u2", authorHandle: null, authorName: "Ravi K", text: "guide", objectId: "page-1_44" },
        ]);
    });
});

const trigger = (overrides: any = {}) => ({
    id: "trig-1",
    keywords: ["guide"],
    match: "CONTAINS",
    contentPostId: null,
    publicCommentReply: null,
    contentPost: null,
    ...overrides,
});
const comment = (overrides: any = {}) => ({
    platform: "INSTAGRAM" as const,
    accountExternalId: "ig-1",
    commentId: "c1",
    authorId: "u9",
    authorHandle: "@asha",
    authorName: null,
    text: "send the guide",
    objectId: "m1",
    ...overrides,
});

describe("queueing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.keywordTrigger.findMany.mockResolvedValue([trigger()]);
        mockDb.keywordTriggerReply.count.mockResolvedValue(0);
        mockDb.keywordTriggerReply.create.mockResolvedValue({});
    });

    it("queues one reply per comment for the first matching active trigger", async () => {
        mockDb.keywordTrigger.findMany.mockResolvedValue([trigger({ publicCommentReply: "Sent you a DM!" })]);
        expect(await queueCommentReplies(comment(), [account], NOW)).toBe(1);
        expect(mockDb.keywordTrigger.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { socialAccountId: "acc-ig", teamId: "team-a", active: true, scope: { in: ["COMMENT", "BOTH"] } },
        }));
        expect(mockDb.keywordTriggerReply.create).toHaveBeenCalledWith({
            data: {
                teamId: "team-a",
                triggerId: "trig-1",
                socialAccountId: "acc-ig",
                sourceKey: "comment:c1",
                personKey: "u9",
                personHandle: "@asha",
                commentId: "c1",
                publicStatus: "PENDING",
            },
        });
    });

    it("queues nothing without a keyword match, within the per-person cooldown, or for a replayed delivery", async () => {
        expect(await queueCommentReplies(comment({ text: "love this" }), [account], NOW)).toBe(0);

        mockDb.keywordTriggerReply.count.mockResolvedValueOnce(1);
        expect(await queueCommentReplies(comment(), [account], NOW)).toBe(0);
        expect(mockDb.keywordTriggerReply.count).toHaveBeenCalledWith({
            where: { triggerId: "trig-1", personKey: "u9", createdAt: { gte: new Date(NOW.getTime() - 24 * HOUR) } },
        });

        mockDb.keywordTriggerReply.create.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
        expect(await queueCommentReplies(comment(), [account], NOW)).toBe(0);
    });

    it("never answers the account's own comment, even if Instagram gives it a different id", async () => {
        expect(await queueCommentReplies(comment({ authorId: "other-id", authorHandle: "@Maker" }), [{ ...account, handle: "@maker" }], NOW)).toBe(0);
        expect(mockDb.keywordTriggerReply.create).not.toHaveBeenCalled();
    });

    it("limits a post-restricted trigger to comments on that post, whatever form the post id takes", async () => {
        const restricted = trigger({ contentPostId: "post-1", contentPost: { targets: [{ externalId: "page-1_44" }] } });
        mockDb.keywordTrigger.findMany.mockResolvedValue([restricted]);
        expect(await queueCommentReplies(comment({ objectId: "44" }), [account], NOW)).toBe(1);
        expect(await queueCommentReplies(comment({ commentId: "c2", objectId: "page-1_45" }), [account], NOW)).toBe(0);

        // DMs aren't tied to a post.
        mockDb.keywordTrigger.findMany.mockResolvedValue([restricted]);
        expect(await queueDmReply(account, { mid: "mid-1", senderId: "igsid-9", text: "guide", leadId: "lead-1" }, NOW)).toBe(true);
        expect(mockDb.keywordTriggerReply.create).toHaveBeenLastCalledWith({
            data: { teamId: "team-a", triggerId: "trig-1", socialAccountId: "acc-ig", sourceKey: "dm:mid-1", personKey: "igsid-9", leadId: "lead-1" },
        });
        expect(mockDb.keywordTrigger.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
            where: expect.objectContaining({ scope: { in: ["DM", "BOTH"] } }),
        }));
    });
});

describe("sendPendingAutoReplies", () => {
    const igAccount = {
        id: "acc-ig",
        teamId: "team-a",
        platform: "INSTAGRAM",
        externalId: "ig-1",
        parentExternalId: "page-1",
        status: "CONNECTED",
        scopes: ["instagram_manage_comments", "pages_messaging", "instagram_manage_messages"],
        encryptedToken: { plain: "user-token" },
    };
    const fbAccount = { ...igAccount, id: "acc-fb", platform: "FACEBOOK_PAGE", externalId: "page-1", parentExternalId: null, scopes: ["pages_messaging", "pages_manage_engagement"], encryptedToken: { plain: "page-token" } };

    function row(overrides: any = {}, triggerOverrides: any = {}) {
        const r = {
            id: `row-${++store.seq}`,
            teamId: "team-a",
            socialAccountId: "acc-ig",
            sourceKey: "comment:c1",
            personKey: "u9",
            personHandle: "@asha",
            commentId: "c1",
            leadId: null,
            status: "PENDING",
            publicStatus: null,
            messageId: null,
            lastError: null,
            createdAt: new Date(NOW.getTime() - 60_000),
            updatedAt: new Date(NOW.getTime() - 60_000),
            trigger: { id: "trig-1", teamId: "team-a", active: true, replyText: "Here's the guide", publicCommentReply: null, landingPageId: null, socialAccount: igAccount, ...triggerOverrides },
            ...overrides,
        };
        store.rows.set(r.id, r);
        return r;
    }
    const get = (id: string) => store.rows.get(id);

    beforeEach(() => {
        vi.clearAllMocks();
        store.rows.clear();
        mockDb.keywordTriggerReply.findMany.mockImplementation(async ({ where, take }: any) =>
            [...store.rows.values()]
                .filter((r) => matches(r, where))
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
                .slice(0, take)
        );
        mockDb.keywordTriggerReply.updateMany.mockImplementation(async ({ where, data }: any) => {
            let count = 0;
            for (const r of store.rows.values()) if (matches(r, where)) { Object.assign(r, data, { updatedAt: NOW }); count++; }
            return { count };
        });
        mockDb.keywordTriggerReply.update.mockImplementation(async ({ where, data }: any) => Object.assign(get(where.id), data));
        mockDb.keywordTriggerReply.groupBy.mockResolvedValue([]);
        isCreatorFunnelEnabled.mockResolvedValue(true);
        pageTokenFor.mockResolvedValue("page-token");
        graphCall.mockResolvedValue({ recipient_id: "igsid-9", message_id: "mid-out" });
        graphPostJson.mockResolvedValue({ recipient_id: "psid-3", message_id: "mid-fb" });
        findOrCreateContact.mockResolvedValue({ contact: { id: "contact-1", leadId: "lead-new" }, isNew: true });
        applyFunnelEvent.mockResolvedValue({ changed: true });
        mockDb.message.create.mockResolvedValue({});
    });

    it("sends an Instagram private reply to the comment, then makes the commenter a lead keyed by the id Meta returns", async () => {
        const r = row();
        await sendPendingAutoReplies(NOW);

        expect(graphCall).toHaveBeenCalledWith("POST", "page-1/messages", { recipient: '{"comment_id":"c1"}', message: '{"text":"Here\'s the guide"}' }, "page-token");
        expect(get(r.id)).toMatchObject({ status: "SENT", messageId: "mid-out", leadId: "lead-new" });
        expect(findOrCreateContact).toHaveBeenCalledWith({ id: "acc-ig", teamId: "team-a", platform: "INSTAGRAM" }, "igsid-9", { source: "instagram_comment", handle: "@asha", name: null });
        expect(applyFunnelEvent).toHaveBeenCalledWith("team-a", "lead-new", "social_first_touch");
        expect(mockDb.message.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ leadId: "lead-new", direction: "OUTBOUND", platform: "INSTAGRAM", sender: "Auto-reply", externalId: "acc-ig:mid-out" }),
        });
    });

    it("never sends a comment's reply twice, even when two ticks race or Meta didn't confirm", async () => {
        const r = row();
        graphCall.mockRejectedValueOnce(new GraphError("Meta didn't answer in time.", true));
        await sendPendingAutoReplies(NOW);
        expect(get(r.id).status).toBe("UNCONFIRMED");
        await sendPendingAutoReplies(NOW);
        expect(graphCall).toHaveBeenCalledTimes(1);

        // Another worker already claimed it between the read and the claim.
        const raced = row({ sourceKey: "comment:c9", commentId: "c9" });
        mockDb.keywordTriggerReply.findMany.mockImplementationOnce(async () => {
            const snapshot = { ...raced };
            raced.status = "SENDING";
            return [snapshot];
        });
        await sendPendingAutoReplies(NOW);
        expect(graphCall).toHaveBeenCalledTimes(1);
    });

    it("records a refusal as failed, with Meta's reason", async () => {
        const r = row();
        graphCall.mockRejectedValueOnce(new GraphError("(#10) Outside of allowed window", false));
        await sendPendingAutoReplies(NOW);
        expect(get(r.id)).toMatchObject({ status: "FAILED", lastError: "(#10) Outside of allowed window" });
        expect(mockDb.message.create).not.toHaveBeenCalled();
    });

    it("skips without calling Meta when the trigger was switched off, the flag is off, or the comment is over 7 days old", async () => {
        const off = row({}, { active: false });
        await sendPendingAutoReplies(NOW);
        expect(get(off.id).status).toBe("SKIPPED");

        store.rows.clear();
        isCreatorFunnelEnabled.mockResolvedValue(false);
        const flagOff = row();
        await sendPendingAutoReplies(NOW);
        expect(get(flagOff.id).status).toBe("SKIPPED");

        store.rows.clear();
        isCreatorFunnelEnabled.mockResolvedValue(true);
        const old = row({ createdAt: new Date(NOW.getTime() - 7 * 24 * HOUR) });
        await sendPendingAutoReplies(NOW);
        expect(get(old.id)).toMatchObject({ status: "SKIPPED", lastError: expect.stringContaining("7 days") });

        expect(graphCall).not.toHaveBeenCalled();
    });

    it("fails without calling Meta when a permission is missing or the linked landing page isn't published", async () => {
        const noScope = row({}, { socialAccount: { ...igAccount, scopes: ["pages_messaging"] } });
        await sendPendingAutoReplies(NOW);
        expect(get(noScope.id)).toMatchObject({ status: "FAILED", lastError: expect.stringContaining("instagram_manage_comments") });

        store.rows.clear();
        mockDb.landingPage.findFirst.mockResolvedValue(null);
        const unpublished = row({}, { landingPageId: "lp-1" });
        await sendPendingAutoReplies(NOW);
        expect(get(unpublished.id)).toMatchObject({ status: "FAILED", lastError: expect.stringContaining("landing page") });

        expect(graphCall).not.toHaveBeenCalled();
    });

    it("adds the landing page link", async () => {
        mockDb.landingPage.findFirst.mockResolvedValue({ slug: "free-guide" });
        row({}, { landingPageId: "lp-1" });
        await sendPendingAutoReplies(NOW);
        expect(mockDb.landingPage.findFirst).toHaveBeenCalledWith({ where: { id: "lp-1", teamId: "team-a", status: "published" }, select: { slug: true } });
        expect(JSON.parse(graphCall.mock.calls[0][2].message).text).toBe("Here's the guide\n\nhttps://craftmyfunnel.live/p/free-guide");
    });

    it("posts the public reply once: Instagram with the account's own token, Facebook with the Page token", async () => {
        const ig = row({ publicStatus: "PENDING" }, { publicCommentReply: "Check your DMs!" });
        await sendPendingAutoReplies(NOW);
        expect(graphCall).toHaveBeenCalledWith("POST", "c1/replies", { message: "Check your DMs!" }, "user-token");
        expect(get(ig.id).publicStatus).toBe("SENT");

        store.rows.clear();
        graphCall.mockClear();
        const fb = row({ socialAccountId: "acc-fb", commentId: "p_c1", sourceKey: "comment:p_c1", publicStatus: "PENDING" }, { publicCommentReply: "Sent!", socialAccount: fbAccount });
        await sendPendingAutoReplies(NOW);
        expect(graphPostJson).toHaveBeenCalledWith("page-1/messages", { recipient: { comment_id: "p_c1" }, message: { text: "Here's the guide" } }, "page-token");
        expect(graphCall).toHaveBeenCalledWith("POST", "p_c1/comments", { message: "Sent!" }, "page-token");
        expect(get(fb.id)).toMatchObject({ status: "SENT", publicStatus: "SENT" });

        await sendPendingAutoReplies(NOW);
        expect(graphCall).toHaveBeenCalledTimes(1);
    });

    it("doesn't post the public reply when the DM didn't go out", async () => {
        const r = row({ publicStatus: "PENDING" }, { publicCommentReply: "Sent you a DM!", socialAccount: { ...igAccount, scopes: ["pages_messaging"] } });
        await sendPendingAutoReplies(NOW);
        expect(get(r.id)).toMatchObject({ status: "FAILED", publicStatus: "SKIPPED" });

        store.rows.clear();
        graphCall.mockRejectedValueOnce(new GraphError("Meta didn't answer in time.", true));
        const unsure = row({ publicStatus: "PENDING" }, { publicCommentReply: "Sent you a DM!" });
        await sendPendingAutoReplies(NOW);
        expect(get(unsure.id)).toMatchObject({ status: "UNCONFIRMED", publicStatus: "SKIPPED" });
        expect(graphCall).toHaveBeenCalledTimes(1); // the DM attempt only
    });

    it("answers a keyword DM in the conversation, on the lead it came from", async () => {
        const dm = row({ socialAccountId: "acc-fb", sourceKey: "dm:mid-1", personKey: "psid-3", commentId: null, leadId: "lead-1" }, { socialAccount: fbAccount });
        await sendPendingAutoReplies(NOW);
        expect(graphPostJson).toHaveBeenCalledWith("page-1/messages", { recipient: { id: "psid-3" }, messaging_type: "RESPONSE", message: { text: "Here's the guide" } }, "page-token");
        expect(findOrCreateContact).not.toHaveBeenCalled();
        expect(mockDb.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ leadId: "lead-1", platform: "FACEBOOK", externalId: "acc-fb:mid-fb" }) });
        expect(get(dm.id).status).toBe("SENT");
    });

    it("holds a capped account's replies without holding up other accounts", async () => {
        mockDb.keywordTriggerReply.groupBy.mockResolvedValue([{ socialAccountId: "acc-ig", _count: { _all: ACCOUNT_HOURLY_LIMIT } }]);
        const capped = Array.from({ length: 25 }, (_, i) => row({ sourceKey: `comment:c${i}`, commentId: `c${i}` }));
        const other = row({ socialAccountId: "acc-fb", sourceKey: "comment:p_c1", commentId: "p_c1", createdAt: NOW }, { socialAccount: fbAccount });

        await sendPendingAutoReplies(NOW);

        expect(capped.every((r) => get(r.id).status === "PENDING")).toBe(true);
        expect(get(other.id).status).toBe("SENT");
        expect(graphCall).not.toHaveBeenCalled();
        expect(graphPostJson).toHaveBeenCalledTimes(1);
    });
});
