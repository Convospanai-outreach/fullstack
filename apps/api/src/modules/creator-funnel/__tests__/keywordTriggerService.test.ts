import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    socialAccount: { findFirst: vi.fn(), findMany: vi.fn() },
    contentPost: { findFirst: vi.fn(), findMany: vi.fn() },
    landingPage: { findFirst: vi.fn(), findMany: vi.fn() },
    keywordTrigger: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    keywordTriggerReply: { count: vi.fn(), findFirst: vi.fn() },
}));
const evaluate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/governance/service/guardrailService", () => ({ guardrailService: { evaluate } }));

import { createTrigger, createTriggerSchema, deleteTrigger, listTriggers, neededScopes, updateTrigger } from "../keywordTriggerService";

const igAccount = { id: "acc-ig", platform: "INSTAGRAM", status: "CONNECTED", scopes: ["instagram_manage_comments", "pages_messaging"] };
const input = (overrides: any = {}) => createTriggerSchema.parse({ socialAccountId: "acc-ig", keywords: ["GUIDE", " guide "], replyText: "Here you go", ...overrides });

describe("keywordTriggerService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.socialAccount.findFirst.mockResolvedValue(igAccount);
        evaluate.mockResolvedValue({ isSafe: true, violations: [] });
        mockDb.keywordTrigger.create.mockImplementation(async ({ data }: any) => ({ id: "trig-1", ...data }));
        mockDb.keywordTrigger.update.mockImplementation(async ({ data }: any) => ({ id: "trig-1", ...data }));
    });

    it("saves a new auto-reply switched off, scoped to the team's account", async () => {
        const trigger = await createTrigger("team-a", "user-1", input());
        expect(mockDb.socialAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "acc-ig", teamId: "team-a", platform: { in: ["INSTAGRAM", "FACEBOOK_PAGE"] } },
        }));
        expect(trigger).toMatchObject({ active: false, teamId: "team-a", createdById: "user-1", scope: "COMMENT", match: "CONTAINS", keywords: ["GUIDE", "guide"] });
    });

    it("refuses another team's account, a post not live on the account, an unpublished page, and blocked content", async () => {
        mockDb.socialAccount.findFirst.mockResolvedValueOnce(null);
        await expect(createTrigger("team-a", "user-1", input())).rejects.toMatchObject({ status: 400 });

        mockDb.contentPost.findFirst.mockResolvedValueOnce(null);
        await expect(createTrigger("team-a", "user-1", input({ contentPostId: "post-1" }))).rejects.toMatchObject({ status: 400, message: "That post isn't live on this account." });
        expect(mockDb.contentPost.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "post-1", teamId: "team-a", targets: { some: { socialAccountId: "acc-ig", status: "PUBLISHED", externalId: { not: null } } } },
        }));

        mockDb.landingPage.findFirst.mockResolvedValueOnce(null);
        await expect(createTrigger("team-a", "user-1", input({ landingPageId: "lp-1" }))).rejects.toMatchObject({ status: 400 });

        evaluate.mockResolvedValueOnce({ isSafe: true, violations: [] }).mockResolvedValueOnce({ isSafe: false, violations: [{ reason: "No discounts in replies" }] });
        await expect(createTrigger("team-a", "user-1", input({ publicCommentReply: "50% off!" }))).rejects.toMatchObject({ status: 400, message: "No discounts in replies" });

        expect(mockDb.keywordTrigger.create).not.toHaveBeenCalled();
    });

    it("counts the reply's size in bytes and needs real words as keywords", async () => {
        await expect(createTrigger("team-a", "user-1", input({ replyText: "é".repeat(351) }))).rejects.toMatchObject({ status: 400 });
        await expect(createTrigger("team-a", "user-1", input({ keywords: ["!!!"] }))).rejects.toMatchObject({ status: 400 });
    });

    it("drops the public reply on a DM-only trigger", async () => {
        const trigger = await createTrigger("team-a", "user-1", input({ scope: "DM", publicCommentReply: "Check DMs" }));
        expect(trigger).toMatchObject({ scope: "DM", publicCommentReply: null });
    });

    it("switching on checks the permissions its sends need, and records who switched it on", async () => {
        const existing = { id: "trig-1", socialAccountId: "acc-ig", scope: "BOTH", keywords: ["guide"], match: "CONTAINS", contentPostId: null, replyText: "Hi", publicCommentReply: "Sent!", landingPageId: null, active: false };
        mockDb.keywordTrigger.findFirst.mockResolvedValue(existing);

        await expect(updateTrigger("team-a", "user-2", "trig-1", { active: true })).rejects.toMatchObject({
            status: 409,
            message: "Reconnect this account and allow: instagram_manage_messages.",
        });

        mockDb.socialAccount.findFirst.mockResolvedValue({ ...igAccount, scopes: [...igAccount.scopes, "instagram_manage_messages"] });
        const on = await updateTrigger("team-a", "user-2", "trig-1", { active: true });
        expect(on).toMatchObject({ active: true, activatedById: "user-2", activatedAt: expect.any(Date) });

        mockDb.socialAccount.findFirst.mockResolvedValue({ ...igAccount, status: "NEEDS_RECONNECT" });
        await expect(updateTrigger("team-a", "user-2", "trig-1", { active: true })).rejects.toMatchObject({ status: 409 });
        // Switching off always works, even when the reply no longer passes the content rules.
        evaluate.mockResolvedValue({ isSafe: false, violations: [{ reason: "New rule" }] });
        await expect(updateTrigger("team-a", "user-2", "trig-1", { active: false })).resolves.toMatchObject({ active: false });
        expect(mockDb.keywordTrigger.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { active: false } }));
        evaluate.mockResolvedValue({ isSafe: true, violations: [] });

        mockDb.keywordTrigger.findFirst.mockResolvedValue(null);
        await expect(updateTrigger("team-a", "user-2", "nope", { active: false })).rejects.toMatchObject({ status: 404 });
    });

    it("needs the right permission per send", () => {
        expect(neededScopes("INSTAGRAM", "COMMENT", true).sort()).toEqual(["instagram_manage_comments", "pages_messaging"]);
        expect(neededScopes("FACEBOOK_PAGE", "COMMENT", true).sort()).toEqual(["pages_manage_engagement", "pages_messaging"]);
        expect(neededScopes("INSTAGRAM", "DM", true)).toEqual(["instagram_manage_messages"]);
    });

    it("deletes only the team's trigger", async () => {
        mockDb.keywordTrigger.deleteMany.mockResolvedValueOnce({ count: 0 });
        await expect(deleteTrigger("team-a", "trig-x")).rejects.toMatchObject({ status: 404 });
        expect(mockDb.keywordTrigger.deleteMany).toHaveBeenCalledWith({ where: { id: "trig-x", teamId: "team-a" } });
    });

    it("lists triggers with last week's sends and latest problem, plus the editor's options", async () => {
        mockDb.keywordTrigger.findMany.mockResolvedValue([{ id: "trig-1", active: true }]);
        mockDb.socialAccount.findMany.mockResolvedValue([{ id: "acc-ig", platform: "INSTAGRAM", handle: "@maker", status: "CONNECTED" }]);
        mockDb.landingPage.findMany.mockResolvedValue([{ id: "lp-1", slug: "guide", title: "Guide" }]);
        mockDb.contentPost.findMany.mockResolvedValue([{ id: "post-1", body: "x".repeat(200), targets: [{ socialAccountId: "acc-ig" }] }]);
        mockDb.keywordTriggerReply.count.mockResolvedValue(3);
        mockDb.keywordTriggerReply.findFirst.mockResolvedValue({ lastError: "(#10) blocked", updatedAt: new Date() });

        const list = await listTriggers("team-a");
        expect(list.triggers).toEqual([{ id: "trig-1", active: true, sentLast7Days: 3, lastError: "(#10) blocked" }]);
        expect(list.posts).toEqual([{ id: "post-1", body: "x".repeat(120), accountIds: ["acc-ig"] }]);
        expect(mockDb.landingPage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", status: "published" } }));
    });
});
