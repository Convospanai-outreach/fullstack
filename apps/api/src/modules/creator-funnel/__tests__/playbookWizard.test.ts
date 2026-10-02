import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    playbookRun: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    product: { findFirst: vi.fn() },
    iCP: { findFirst: vi.fn(), create: vi.fn() },
    socialAccount: { findMany: vi.fn() },
    contentPost: { findMany: vi.fn(), createMany: vi.fn() },
    contentPostTarget: { createMany: vi.fn() },
    $transaction: vi.fn(),
}));
const askAI = vi.hoisted(() => vi.fn());
const enqueue = vi.hoisted(() => vi.fn());
const assertAccounts = vi.hoisted(() => vi.fn());
const deletePost = vi.hoisted(() => vi.fn());
const getStageMix = vi.hoisted(() => vi.fn());
const bundle = vi.hoisted(() => ({
    DEFAULT_KEYWORD: "GUIDE",
    ensurePage: vi.fn(),
    triggerAccount: vi.fn(),
    createPlanTrigger: vi.fn(),
    deleteBundle: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/aiService", () => ({ aiService: { askAI } }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue } }));
vi.mock("@/modules/landing-agent/service", () => ({ extractJsonCandidate: (raw: string) => raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1) }));
vi.mock("../playbookBundle", () => bundle);
vi.mock("../keywordTriggers", () => ({ WEB_BASE_URL: "https://app.test" }));
vi.mock("../contentPostService", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../contentPostService")>()),
    assertAccounts,
    deletePost,
    getStageMix,
}));

import { ContentPostError } from "../contentPostService";
import { allocateStages, buildPostPrompt, deleteRun, generatePlaybookRun, pageSpecs, planSlots, retryRun, startRun, STALE_MS } from "../playbookWizard";

const TEAM = "team-a";
// 2030-01-07 is a Monday; 09:00 in Kolkata.
const NOW = new Date("2030-01-07T03:30:00Z");

const input = (overrides: any = {}) => ({
    name: "Spring launch",
    offer: { type: "product", productId: "prod-1" },
    audience: { icpId: "icp-1" },
    leadMagnet: "A 5-day email course on batch cooking",
    tone: "Warm and direct",
    startDate: "2030-01-08",
    timezone: "Asia/Kolkata",
    postsPerWeek: 3,
    accountIds: ["acc-ig"],
    ...overrides,
});

const draft = (n: number) => ({ facebook: `FB ${n}`, instagram: `IG ${n} #food`, linkedin: `LI ${n}`, visualBrief: `Photo ${n}` });
let calls = 0;
const postReply = () => `Here you go: ${JSON.stringify(draft(calls++))}`;

const expectError = async (promise: Promise<unknown>, status: number) => {
    const error = await promise.catch((e) => e);
    expect(error).toBeInstanceOf(ContentPostError);
    expect(error.status).toBe(status);
    return error as ContentPostError;
};

describe("playbookWizard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.$transaction.mockImplementation((fn: any) => fn(mockDb));
        mockDb.product.findFirst.mockResolvedValue({ id: "prod-1" });
        mockDb.iCP.findFirst.mockResolvedValue({ id: "icp-1" });
        mockDb.iCP.create.mockResolvedValue({ id: "icp-new" });
        mockDb.playbookRun.findFirst.mockResolvedValue(null);
        mockDb.playbookRun.create.mockImplementation(async ({ data }: any) => ({ id: "run-1", status: "GENERATING", updatedAt: new Date(NOW), ...data }));
        mockDb.playbookRun.updateMany.mockResolvedValue({ count: 1 });
        mockDb.socialAccount.findMany.mockResolvedValue([{ id: "acc-ig" }]);
        getStageMix.mockResolvedValue({ TOFU: 60, MOFU: 30, BOFU: 10, POST: 0 });
        enqueue.mockResolvedValue({ id: "job-1" });
        bundle.triggerAccount.mockResolvedValue({ id: "acc-ig", platform: "INSTAGRAM" });
        bundle.ensurePage.mockImplementation(async (_run: any, spec: any) => (spec.kind === "leadMagnet" ? "lp-magnet" : "lp-sales"));
        bundle.createPlanTrigger.mockResolvedValue(null);
        bundle.deleteBundle.mockResolvedValue({ pagesDeleted: 2, pagesKept: 0, triggerKept: false });
    });

    describe("planning", () => {
        it("splits posts by the stage mix with largest remainders and spreads each stage out", () => {
            const stages = allocateStages({ TOFU: 60, MOFU: 30, BOFU: 10, POST: 0 }, 12);
            const count = (s: string) => stages.filter((x) => x === s).length;
            expect([count("TOFU"), count("MOFU"), count("BOFU"), count("POST")]).toEqual([7, 4, 1, 0]);
            // MOFU isn't bunched at the end: it shows up in the first week already.
            expect(stages.slice(0, 3)).toContain("MOFU");
            expect(allocateStages({ TOFU: 25, MOFU: 25, BOFU: 25, POST: 25 }, 8)).toHaveLength(8);
        });

        it("schedules postsPerWeek slots a week at 10:00 local from the start date, leaving past times unscheduled", () => {
            const slots = planSlots({ startDate: "2030-01-08", timezone: "Asia/Kolkata", postsPerWeek: 3 }, { TOFU: 100, MOFU: 0, BOFU: 0, POST: 0 }, NOW);
            expect(slots).toHaveLength(12);
            expect(slots[0]!.scheduledAt!.toISOString()).toBe("2030-01-08T04:30:00.000Z");
            expect(slots[1]!.scheduledAt!.toISOString()).toBe("2030-01-10T04:30:00.000Z");
            expect(slots[3]).toMatchObject({ week: 1 });
            expect(slots[3]!.scheduledAt!.toISOString()).toBe("2030-01-15T04:30:00.000Z");

            const late = planSlots({ startDate: "2030-01-08", timezone: "Asia/Kolkata", postsPerWeek: 3 }, { TOFU: 100, MOFU: 0, BOFU: 0, POST: 0 }, new Date("2030-01-09T00:00:00Z"));
            expect(late[0]!.scheduledAt).toBeNull();
            expect(late[1]!.scheduledAt).not.toBeNull();
        });

        it("keeps 10:00 local across a daylight-saving change", () => {
            // US clocks go forward on 2030-03-10.
            const slots = planSlots({ startDate: "2030-03-04", timezone: "America/New_York", postsPerWeek: 2 }, { TOFU: 100, MOFU: 0, BOFU: 0, POST: 0 }, new Date("2030-03-01T00:00:00Z"));
            expect(slots[0]!.scheduledAt!.toISOString()).toBe("2030-03-04T15:00:00.000Z");
            expect(slots[2]!.scheduledAt!.toISOString()).toBe("2030-03-11T14:00:00.000Z");
        });
    });

    describe("startRun", () => {
        it("checks the start date, the product, the booking link and the audience against this team", async () => {
            await expectError(startRun(TEAM, "user-1", input({ startDate: "2030-01-07" }) as any, NOW), 400);
            await expectError(startRun(TEAM, "user-1", input({ startDate: "2030-04-07" }) as any, NOW), 400);
            mockDb.product.findFirst.mockResolvedValueOnce(null);
            await expectError(startRun(TEAM, "user-1", input() as any, NOW), 400);
            expect(mockDb.product.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "prod-1", teamId: TEAM, isActive: true } }));
            await expectError(startRun(TEAM, "user-1", input({ offer: { type: "booking", bookingUrl: "http://cal.example/me", description: "Intro call" } }) as any, NOW), 400);
            mockDb.iCP.findFirst.mockResolvedValueOnce(null);
            await expectError(startRun(TEAM, "user-1", input() as any, NOW), 400);
            expect(mockDb.playbookRun.create).not.toHaveBeenCalled();
        });

        it("refuses a second plan while one is being written", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValueOnce({ id: "run-0" });
            await expectError(startRun(TEAM, "user-1", input() as any, NOW), 409);
            expect(mockDb.playbookRun.create).not.toHaveBeenCalled();
        });

        it("creates an audience from a description, saves the run and queues the writing job", async () => {
            const run = await startRun(TEAM, "user-1", input({ audience: { description: "Busy parents who want to cook less" } }) as any, NOW);
            expect(mockDb.iCP.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ teamId: TEAM, criteria: { description: "Busy parents who want to cook less", source: "playbook-wizard" } }),
            }));
            expect(mockDb.playbookRun.create.mock.calls[0][0].data).toMatchObject({ teamId: TEAM, productId: "prod-1", icpId: "icp-new", icpCreated: true, bookingUrl: null });
            expect(enqueue).toHaveBeenCalledWith("playbook_generate", { runId: "run-1", teamId: TEAM }, { teamId: TEAM, idempotencyKey: `playbook_run_run-1_${NOW.getTime()}` });
            expect(run.id).toBe("run-1");
        });

        it("takes a booking link as the offer", async () => {
            await startRun(TEAM, "user-1", input({ offer: { type: "booking", bookingUrl: "https://cal.example/me", description: "Intro call" } }) as any, NOW);
            expect(mockDb.playbookRun.create.mock.calls[0][0].data).toMatchObject({ productId: null, bookingUrl: "https://cal.example/me", icpId: "icp-1", icpCreated: false });
        });

        it("marks the run failed when the job can't be queued", async () => {
            enqueue.mockRejectedValueOnce(new Error("db down"));
            await startRun(TEAM, "user-1", input() as any, NOW);
            expect(mockDb.playbookRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", status: "GENERATING" }, data: { status: "FAILED", error: expect.any(String) } });
        });
    });

    describe("generatePlaybookRun", () => {
        const stored = (overrides: any = {}) => ({
            id: "run-1",
            teamId: TEAM,
            createdById: "user-1",
            status: "GENERATING",
            inputs: input(),
            product: { name: "Batch Cooking Course", description: "Six weeks of recipes", priceAmount: 49900, currency: "INR" },
            icp: { name: "Busy parents", description: null },
            ...overrides,
        });

        it("writes 4 weeks of DRAFT posts with per-channel text and a visual brief, linked to the run, without publishing anything", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue(stored());
            askAI.mockImplementation(async () => postReply());
            expect(await generatePlaybookRun("run-1", NOW)).toEqual({ done: true });

            expect(askAI).toHaveBeenCalledTimes(12); // one short call per post
            expect(askAI.mock.calls[0][1]).toBe(TEAM);
            // The cheap, fast tier (DeepSeek Flash without thinking), not the STRATEGIC default.
            expect(askAI.mock.calls[0][2]).toMatchObject({ complexity: "ROUTINE", expectsJson: true });
            const posts = mockDb.contentPost.createMany.mock.calls[0][0].data;
            expect(posts).toHaveLength(12);
            for (const p of posts) {
                expect(p).toMatchObject({ teamId: TEAM, playbookRunId: "run-1", createdById: "user-1", timezone: "Asia/Kolkata" });
                expect(p.status).toBeUndefined(); // the column default: DRAFT
                expect(p.body).toMatch(/^FB /);
                expect(p.channelCaptions).toEqual({ INSTAGRAM: expect.stringMatching(/^IG /), LINKEDIN: expect.stringMatching(/^LI /) });
                expect(p.visualBrief).toMatch(/^Photo /);
            }
            expect(posts.filter((p: any) => p.funnelStage === "TOFU")).toHaveLength(7);
            expect(mockDb.contentPostTarget.createMany.mock.calls[0][0].data).toHaveLength(12);
            expect(mockDb.socialAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: TEAM, id: { in: ["acc-ig"] }, status: { not: "DISCONNECTED" } } }));
            expect(mockDb.playbookRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", status: "GENERATING" }, data: { status: "READY", error: null, notes: null } });

            // 5b: both landing pages, then the switched-off keyword auto-reply to the lead-magnet page.
            expect(bundle.ensurePage.mock.calls.map((c: any[]) => c[1].kind)).toEqual(["leadMagnet", "sales"]);
            expect(bundle.createPlanTrigger).toHaveBeenCalledWith(expect.objectContaining({ id: "run-1" }), {
                socialAccountId: "acc-ig", keyword: "GUIDE", leadMagnet: "A 5-day email course on batch cooking", landingPageId: "lp-magnet",
            });
            // Awareness and nurture posts ask for the comment keyword.
            const prompts = askAI.mock.calls.map((c: any[]) => c[0] as string);
            expect(prompts.filter((p) => p.includes('comment "GUIDE"')).length).toBeGreaterThan(0);
            expect(prompts.filter((p) => p.includes("Funnel stage: BOFU") && p.includes('comment "GUIDE"'))).toHaveLength(0);
        });

        it("without an Instagram or Facebook account: no keyword call to action, no trigger, and a note saying why", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue(stored());
            bundle.triggerAccount.mockResolvedValue(null);
            askAI.mockImplementation(async () => postReply());
            expect(await generatePlaybookRun("run-1", NOW)).toEqual({ done: true });
            expect(askAI.mock.calls.some((c: any[]) => (c[0] as string).includes("comment"))).toBe(false);
            expect(bundle.createPlanTrigger).not.toHaveBeenCalled();
            expect(mockDb.playbookRun.updateMany.mock.calls[0][0].data.notes).toMatch(/No Instagram account or Facebook Page/);
        });

        it("records the trigger's problem as a note without failing the plan", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue(stored());
            askAI.mockImplementation(async () => postReply());
            bundle.createPlanTrigger.mockResolvedValue("The comment keyword auto-reply wasn't set up (Blocked).");
            expect(await generatePlaybookRun("run-1", NOW)).toEqual({ done: true });
            expect(mockDb.playbookRun.updateMany).toHaveBeenLastCalledWith({ where: { id: "run-1" }, data: { notes: "The comment keyword auto-reply wasn't set up (Blocked)." } });
        });

        it("fails the run, saving no post, when a landing page can't be made", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue(stored());
            askAI.mockImplementation(async () => postReply());
            bundle.ensurePage.mockRejectedValue(new Error("the plan's audience was deleted"));
            expect(await generatePlaybookRun("run-1", NOW)).toEqual({ done: false });
            expect(mockDb.contentPost.createMany).not.toHaveBeenCalled();
            expect(mockDb.playbookRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", status: "GENERATING" }, data: { status: "FAILED", error: expect.any(String) } });
        });

        it("drafts an opt-in page and a sales page whose buttons open the booking or checkout link", () => {
            const ctx = { teamId: TEAM, inputs: input() as any, product: stored().product, icp: { name: "Busy parents", description: null } };
            const [magnet, sales] = pageSpecs(ctx, { productId: "prod-1", bookingUrl: null }, "https://app.test");
            expect(magnet).toMatchObject({ kind: "leadMagnet", ctaHref: null });
            expect(magnet!.prompt).toContain("Opt-in page for a free lead magnet: A 5-day email course on batch cooking.");
            expect(sales).toMatchObject({ kind: "sales", name: "Batch Cooking Course", ctaHref: "https://app.test/checkout/prod-1" });
            expect(sales!.prompt).toContain("Every call to action is buying it.");

            const bookingCtx = { ...ctx, product: null, inputs: input({ offer: { type: "booking", bookingUrl: "https://cal.example/me", description: "Intro call" } }) as any };
            const [, call] = pageSpecs(bookingCtx, { productId: null, bookingUrl: "https://cal.example/me" }, "https://app.test");
            expect(call).toMatchObject({ name: "Intro call", ctaHref: "https://cal.example/me" });
            expect(call!.prompt).toContain("Every call to action is booking the call.");
        });

        it("saves nothing twice: a repeated job finds the run already claimed", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue(stored());
            askAI.mockImplementation(async () => postReply());
            mockDb.playbookRun.updateMany.mockResolvedValue({ count: 0 });
            expect(await generatePlaybookRun("run-1", NOW)).toEqual({ done: false });
            expect(mockDb.contentPost.createMany).not.toHaveBeenCalled();
        });

        it("does nothing for a run that isn't waiting to be written", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue(null);
            expect(await generatePlaybookRun("run-1", NOW)).toEqual({ done: false });
            expect(askAI).not.toHaveBeenCalled();
        });

        it("records a failure without saving any post when the AI reply is unusable, and doesn't throw", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue(stored());
            askAI.mockImplementationOnce(async () => JSON.stringify({ facebook: "only this" })).mockImplementation(async () => postReply());
            expect(await generatePlaybookRun("run-1", NOW)).toEqual({ done: false });
            expect(mockDb.contentPost.createMany).not.toHaveBeenCalled();
            expect(mockDb.playbookRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", status: "GENERATING" }, data: { status: "FAILED", error: expect.any(String) } });

            vi.clearAllMocks();
            mockDb.playbookRun.updateMany.mockResolvedValue({ count: 1 });
            mockDb.playbookRun.findFirst.mockResolvedValue(stored());
            askAI.mockRejectedValue(new Error("Insufficient credits for AI generation."));
            await expect(generatePlaybookRun("run-1", NOW)).resolves.toEqual({ done: false });
            expect(mockDb.contentPost.createMany).not.toHaveBeenCalled();
            expect(mockDb.playbookRun.updateMany.mock.calls[0][0].data.error).toMatch(/Not enough AI credits/);
            // The first failure stops further (billed) calls.
            expect(askAI.mock.calls.length).toBeLessThanOrEqual(4);
        });

        it("trims captions to Instagram's limit", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue(stored());
            askAI.mockImplementation(async () => JSON.stringify({ ...draft(0), instagram: "y".repeat(5000) }));
            await generatePlaybookRun("run-1", NOW);
            expect([...mockDb.contentPost.createMany.mock.calls[0][0].data[0].channelCaptions.INSTAGRAM]).toHaveLength(2200);
        });

        it("puts the offer, audience, lead magnet, tone, stage and an angle in the prompt", () => {
            const prompt = buildPostPrompt(
                { teamId: TEAM, inputs: input() as any, product: stored().product, icp: { name: "Busy parents", description: "Two kids, no time" } },
                4,
                12,
                { week: 1, stage: "BOFU" },
            );
            expect(prompt).toContain("Batch Cooking Course (499.00 INR): Six weeks of recipes");
            expect(prompt).toContain("Busy parents: Two kids, no time");
            expect(prompt).toContain("A 5-day email course on batch cooking");
            expect(prompt).toContain("Warm and direct");
            expect(prompt).toContain("post 5 of 12 (week 2 of 4)");
            expect(prompt).toContain("Funnel stage: BOFU");
            expect(prompt).toContain("Angle: a simple step-by-step");
            expect(prompt).toContain("at most 600 characters");
        });
    });

    describe("retryRun", () => {
        it("retries only a failed or stuck run, as a new job", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "run-1", teamId: TEAM, updatedAt: new Date(NOW.getTime() + 1) });
            await retryRun(TEAM, "run-1", NOW);
            const where = mockDb.playbookRun.updateMany.mock.calls[0][0].where;
            expect(where).toMatchObject({ id: "run-1", teamId: TEAM });
            expect(where.OR).toEqual([{ status: "FAILED" }, { status: "GENERATING", updatedAt: { lte: new Date(NOW.getTime() - STALE_MS) } }]);
            expect(enqueue).toHaveBeenCalledWith("playbook_generate", { runId: "run-1", teamId: TEAM }, expect.objectContaining({ idempotencyKey: `playbook_run_run-1_${NOW.getTime() + 1}` }));

            mockDb.playbookRun.updateMany.mockResolvedValue({ count: 0 });
            await expectError(retryRun(TEAM, "run-1", NOW), 409);
        });
    });

    describe("deleteRun", () => {
        it("deletes the drafts through the post rules, keeps live posts, then the run", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue({ id: "run-1", teamId: TEAM, leadMagnetCampaignId: "lc-1" });
            mockDb.contentPost.findMany.mockResolvedValue([{ id: "p-1" }, { id: "p-live" }, { id: "p-3" }]);
            deletePost.mockImplementation(async (_team: string, id: string) => {
                if (id === "p-live") throw new ContentPostError(409, "Part of this post is already live");
            });
            mockDb.playbookRun.deleteMany.mockResolvedValue({ count: 1 });

            expect(await deleteRun(TEAM, "run-1")).toEqual({ deleted: 2, kept: 1, pagesDeleted: 2, pagesKept: 0, triggerKept: false });
            expect(bundle.deleteBundle).toHaveBeenCalledWith(expect.objectContaining({ id: "run-1", leadMagnetCampaignId: "lc-1" }));
            expect(mockDb.contentPost.findMany).toHaveBeenCalledWith({ where: { teamId: TEAM, playbookRunId: "run-1" }, select: { id: true } });
            expect(deletePost).toHaveBeenCalledTimes(3);
            expect(mockDb.playbookRun.deleteMany).toHaveBeenCalledWith({ where: { id: "run-1", teamId: TEAM } });
        });

        it("is a 404 for another team's run", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue(null);
            await expectError(deleteRun(TEAM, "run-x"), 404);
            expect(mockDb.playbookRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "run-x", teamId: TEAM } }));
        });

        it("stops on an unexpected error instead of deleting the run", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue({ id: "run-1" });
            mockDb.contentPost.findMany.mockResolvedValue([{ id: "p-1" }]);
            deletePost.mockRejectedValue(new Error("db down"));
            await expect(deleteRun(TEAM, "run-1")).rejects.toThrow("db down");
            expect(mockDb.playbookRun.deleteMany).not.toHaveBeenCalled();
        });
    });
});
