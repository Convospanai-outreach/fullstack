import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
    keywordTriggerReply: { findFirst: vi.fn() },
    contentPost: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { getInstagramSourceForLead } from "../leadSource";

const LONG_BODY = "Free guide: five ways to double your replies this month with simple DM follow-ups that work every time";

const replyWith = (trigger: Record<string, unknown> | null) => (trigger ? { trigger } : null);

describe("getInstagramSourceForLead", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("maps a lead created by a keyword reply to the trigger's first keyword, post and platform", async () => {
        mockDb.keywordTriggerReply.findFirst.mockResolvedValue(
            replyWith({
                id: "trigger-1",
                keywords: ["GUIDE", "FREE"],
                contentPostId: "post-1",
                socialAccount: { platform: "INSTAGRAM" },
            })
        );
        mockDb.contentPost.findFirst.mockResolvedValue({ body: LONG_BODY });

        const source = await getInstagramSourceForLead("team-a", "lead-1");

        expect(source).toEqual({
            triggerId: "trigger-1",
            keyword: "GUIDE",
            contentPostId: "post-1",
            postTitle: LONG_BODY.slice(0, 60),
            platform: "INSTAGRAM",
        });
    });

    it("scopes the reply lookup and the post lookup by teamId", async () => {
        mockDb.keywordTriggerReply.findFirst.mockResolvedValue(
            replyWith({ id: "trigger-1", keywords: ["GUIDE"], contentPostId: "post-1", socialAccount: { platform: "INSTAGRAM" } })
        );
        mockDb.contentPost.findFirst.mockResolvedValue({ body: "Hello" });

        await getInstagramSourceForLead("team-a", "lead-1");

        expect(mockDb.keywordTriggerReply.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", leadId: "lead-1" } }));
        expect(mockDb.contentPost.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "post-1", teamId: "team-a" } }));
    });

    it("returns null when no keyword reply points at the lead, so another team's lead never gets a source", async () => {
        mockDb.keywordTriggerReply.findFirst.mockResolvedValue(null);

        await expect(getInstagramSourceForLead("team-b", "lead-of-team-a")).resolves.toBeNull();
        expect(mockDb.contentPost.findFirst).not.toHaveBeenCalled();
    });

    it("keeps the keyword when the post was deleted (contentPostId set null on the post) and leaves postTitle empty", async () => {
        mockDb.keywordTriggerReply.findFirst.mockResolvedValue(
            replyWith({ id: "trigger-1", keywords: ["GUIDE"], contentPostId: null, socialAccount: { platform: "INSTAGRAM" } })
        );

        const source = await getInstagramSourceForLead("team-a", "lead-1");

        expect(source).toEqual({ triggerId: "trigger-1", keyword: "GUIDE", contentPostId: null, postTitle: null, platform: "INSTAGRAM" });
        expect(mockDb.contentPost.findFirst).not.toHaveBeenCalled();
    });

    it("returns keyword null when the trigger has no keywords, and does not throw when the post row is missing", async () => {
        mockDb.keywordTriggerReply.findFirst.mockResolvedValue(
            replyWith({ id: "trigger-1", keywords: [], contentPostId: "post-gone", socialAccount: { platform: "INSTAGRAM" } })
        );
        mockDb.contentPost.findFirst.mockResolvedValue(null);

        const source = await getInstagramSourceForLead("team-a", "lead-1");

        expect(source).toEqual({ triggerId: "trigger-1", keyword: null, contentPostId: "post-gone", postTitle: null, platform: "INSTAGRAM" });
    });
});
