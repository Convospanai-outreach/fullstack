import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    playbookRun: { updateMany: vi.fn() },
    landingPage: { updateMany: vi.fn(), findMany: vi.fn() },
    landingCampaign: { deleteMany: vi.fn() },
    socialAccount: { findMany: vi.fn() },
    keywordTrigger: { findFirst: vi.fn(), deleteMany: vi.fn() },
    approvalRequest: { updateMany: vi.fn() },
}));
const landing = vi.hoisted(() => ({
    createCampaign: vi.fn(),
    generateBrief: vi.fn(),
    generateWireframes: vi.fn(),
    selectWireframe: vi.fn(),
}));
const triggers = vi.hoisted(() => ({ createTrigger: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/landing-agent/service", () => ({ landingAgentService: landing }));
vi.mock("../keywordTriggerService", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../keywordTriggerService")>()),
    createTrigger: triggers.createTrigger,
}));

import { ContentPostError } from "../contentPostService";
import { createPlanTrigger, deleteBundle, ensurePage, triggerAccount, withCtaHref, type BundleRun } from "../playbookBundle";

const run = (overrides: Partial<BundleRun> = {}): BundleRun => ({
    id: "run-1",
    teamId: "team-a",
    createdById: "user-1",
    icpId: "icp-1",
    leadMagnetCampaignId: null,
    leadMagnetPageId: null,
    salesCampaignId: null,
    salesPageId: null,
    keywordTriggerId: null,
    ...overrides,
});

const sections = [
    { id: "hero", type: "hero", heading: "Book a call", ctaLabel: "Book now" },
    { id: "proof", type: "proof", heading: "Results" },
    { id: "cta", type: "cta_form", heading: "Ready?" },
    { id: "footer", type: "footer", heading: "Brand", ctaLabel: "Back to top" },
];

describe("playbookBundle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.playbookRun.updateMany.mockResolvedValue({ count: 1 });
        landing.createCampaign.mockResolvedValue({ id: "lc-1" });
        landing.generateWireframes.mockResolvedValue([{ id: "wf-best" }, { id: "wf-2" }]);
        landing.selectWireframe.mockResolvedValue({ id: "lp-1", renderedJson: sections });
    });

    describe("ensurePage", () => {
        it("drafts a page through the landing agent, saving each id on the run as it appears", async () => {
            const r = run();
            const id = await ensurePage(r, { kind: "sales", name: "Course", prompt: "Sales page for: Course", ctaHref: "https://cal.example/me" });
            expect(id).toBe("lp-1");
            expect(landing.createCampaign).toHaveBeenCalledWith({ teamId: "team-a", userId: "user-1", name: "Course", prompt: "Sales page for: Course", icpId: "icp-1" });
            expect(mockDb.playbookRun.updateMany).toHaveBeenNthCalledWith(1, { where: { id: "run-1", status: "GENERATING" }, data: { salesCampaignId: "lc-1" } });
            expect(landing.selectWireframe).toHaveBeenCalledWith({ teamId: "team-a", campaignId: "lc-1", wireframeId: "wf-best" });
            const update = mockDb.landingPage.updateMany.mock.calls[0][0];
            expect(update.where).toEqual({ id: "lp-1", teamId: "team-a" });
            expect(update.data.funnelStage).toBe("BOFU");
            expect(update.data.renderedJson.map((s: any) => s.ctaHref)).toEqual(["https://cal.example/me", undefined, "https://cal.example/me", undefined]);
            expect(mockDb.playbookRun.updateMany).toHaveBeenLastCalledWith({ where: { id: "run-1", status: "GENERATING" }, data: { salesPageId: "lp-1" } });
            expect(r.salesPageId).toBe("lp-1");
        });

        it("leaves the lead-magnet page's buttons on its opt-in form", async () => {
            await ensurePage(run(), { kind: "leadMagnet", name: "Guide", prompt: "Opt-in", ctaHref: null });
            expect(mockDb.landingPage.updateMany.mock.calls[0][0].data).toEqual({ funnelStage: "TOFU" });
        });

        it("on a retry, reuses what an earlier attempt made instead of making another copy", async () => {
            expect(await ensurePage(run({ leadMagnetPageId: "lp-done" }), { kind: "leadMagnet", name: "x", prompt: "x", ctaHref: null })).toBe("lp-done");
            expect(landing.createCampaign).not.toHaveBeenCalled();

            await ensurePage(run({ leadMagnetCampaignId: "lc-old" }), { kind: "leadMagnet", name: "x", prompt: "x", ctaHref: null });
            expect(landing.createCampaign).not.toHaveBeenCalled();
            expect(landing.generateBrief).toHaveBeenCalledWith({ teamId: "team-a", campaignId: "lc-old" });
        });

        it("stops when the run was deleted or finished meanwhile, and needs the plan's audience", async () => {
            mockDb.playbookRun.updateMany.mockResolvedValue({ count: 0 });
            await expect(ensurePage(run(), { kind: "leadMagnet", name: "x", prompt: "x", ctaHref: null })).rejects.toThrow(/no longer being written/);
            expect(landing.generateBrief).not.toHaveBeenCalled();
            await expect(ensurePage(run({ icpId: null }), { kind: "leadMagnet", name: "x", prompt: "x", ctaHref: null })).rejects.toThrow(/audience/);
        });
    });

    it("withCtaHref links every button, in a section list or a {sections} object", () => {
        expect((withCtaHref({ sections }, "https://x.test") as any).sections[0].ctaHref).toBe("https://x.test");
        expect(withCtaHref({ html: "<p>edited</p>" }, "https://x.test")).toEqual({ html: "<p>edited</p>" });
    });

    it("prefers an Instagram account for the keyword auto-reply", async () => {
        expect(await triggerAccount("team-a", [])).toBeNull();
        mockDb.socialAccount.findMany.mockResolvedValue([{ id: "acc-fb", platform: "FACEBOOK_PAGE" }, { id: "acc-ig", platform: "INSTAGRAM" }]);
        expect(await triggerAccount("team-a", ["acc-fb", "acc-ig"])).toEqual({ id: "acc-ig", platform: "INSTAGRAM" });
        expect(mockDb.socialAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { teamId: "team-a", id: { in: ["acc-fb", "acc-ig"] }, platform: { in: ["INSTAGRAM", "FACEBOOK_PAGE"] }, status: { not: "DISCONNECTED" } },
        }));
    });

    describe("createPlanTrigger", () => {
        it("saves a switched-off auto-reply through the trigger's own checks and records it on the run", async () => {
            triggers.createTrigger.mockResolvedValue({ id: "trig-1", active: false });
            expect(await createPlanTrigger(run(), { socialAccountId: "acc-ig", keyword: "GUIDE", leadMagnet: "Meal plan", landingPageId: "lp-1" })).toBeNull();
            expect(triggers.createTrigger).toHaveBeenCalledWith("team-a", "user-1", expect.objectContaining({
                socialAccountId: "acc-ig", keywords: ["GUIDE"], replyText: "Here's your free Meal plan:", landingPageId: "lp-1", scope: "COMMENT",
            }));
            expect(mockDb.playbookRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", teamId: "team-a" }, data: { keywordTriggerId: "trig-1" } });
        });

        it("turns a refusal into a note for the plan", async () => {
            triggers.createTrigger.mockRejectedValue(new ContentPostError(400, "Blocked by your workspace's content rules."));
            expect(await createPlanTrigger(run(), { socialAccountId: "acc-ig", keyword: "GUIDE", leadMagnet: "x", landingPageId: "lp-1" }))
                .toMatch(/wasn't set up \(Blocked by your workspace's content rules\.\)/);
        });

        it("doesn't make a second one", async () => {
            expect(await createPlanTrigger(run({ keywordTriggerId: "trig-1" }), { socialAccountId: "a", keyword: "GUIDE", leadMagnet: "x", landingPageId: "lp-1" })).toBeNull();
            expect(triggers.createTrigger).not.toHaveBeenCalled();
        });
    });

    describe("deleteBundle", () => {
        it("deletes draft pages (withdrawing publish approvals) and a switched-off trigger", async () => {
            mockDb.keywordTrigger.findFirst.mockResolvedValue({ active: false });
            mockDb.landingPage.findMany.mockResolvedValue([{ id: "lp-1", status: "draft" }]);
            mockDb.landingCampaign.deleteMany.mockResolvedValue({ count: 1 });
            const result = await deleteBundle(run({ keywordTriggerId: "trig-1", leadMagnetCampaignId: "lc-1", salesCampaignId: "lc-2" }));
            expect(result).toEqual({ pagesDeleted: 2, pagesKept: 0, triggerKept: false });
            expect(mockDb.keywordTrigger.deleteMany).toHaveBeenCalledWith({ where: { id: "trig-1", teamId: "team-a", active: false } });
            expect(mockDb.approvalRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { teamId: "team-a", entityType: "LandingPage", entityId: { in: ["lp-1"] }, status: "PENDING" },
            }));
            expect(mockDb.landingCampaign.deleteMany).toHaveBeenCalledWith({ where: { id: "lc-1", teamId: "team-a", pages: { none: { status: "published" } } } });
        });

        it("keeps a published page and a switched-on trigger", async () => {
            mockDb.keywordTrigger.findFirst.mockResolvedValue({ active: true });
            mockDb.landingPage.findMany.mockResolvedValueOnce([{ id: "lp-1", status: "published" }]).mockResolvedValueOnce([{ id: "lp-2", status: "draft" }]);
            mockDb.landingCampaign.deleteMany.mockResolvedValue({ count: 0 }); // published in the meantime
            const result = await deleteBundle(run({ keywordTriggerId: "trig-1", leadMagnetCampaignId: "lc-1", salesCampaignId: "lc-2" }));
            expect(result).toEqual({ pagesDeleted: 0, pagesKept: 2, triggerKept: true });
            expect(mockDb.keywordTrigger.deleteMany).not.toHaveBeenCalled();
            expect(mockDb.landingCampaign.deleteMany).toHaveBeenCalledTimes(1);
        });
    });
});
