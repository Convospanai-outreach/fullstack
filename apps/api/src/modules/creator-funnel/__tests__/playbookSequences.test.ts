import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    campaign: { create: vi.fn(), deleteMany: vi.fn() },
    campaignSequence: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    sequenceStep: { createMany: vi.fn() },
    playbookRun: { updateMany: vi.fn() },
    product: { count: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { buildEmailPrompt, deleteSequences, emailHtml, ensureSequence, sequenceSpecs, type SequenceRun } from "../playbookSequences";

const run = (overrides: Partial<SequenceRun> = {}): SequenceRun => ({
    id: "run-1",
    teamId: "team-a",
    name: "Spring launch",
    createdById: "user-1",
    icpId: "icp-1",
    nurtureCampaignId: null,
    cartAbandonCampaignId: null,
    postPurchaseCampaignId: null,
    ...overrides,
});

const links = { leadMagnet: "Meal plan", bookingUrl: null, salesPageUrl: "https://app.test/p/course", checkoutUrl: "https://app.test/checkout/prod-1" };
const extractJson = (raw: string) => raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);

describe("playbookSequences", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.$transaction.mockImplementation((fn: any) => fn(mockDb));
        mockDb.campaign.create.mockResolvedValue({ id: "camp-1" });
        mockDb.campaignSequence.create.mockResolvedValue({ id: "seq-1" });
        mockDb.playbookRun.updateMany.mockResolvedValue({ count: 1 });
    });

    describe("sequenceSpecs", () => {
        it("a product offer gets nurture (ending with the sales page), checkout reminders and a testimonial request a week after buying", () => {
            const specs = sequenceSpecs({ ...links, booking: false });
            expect(specs.map((s) => s.kind)).toEqual(["nurture", "cartAbandon", "postPurchase"]);
            expect(specs[0]!.emails.map((e) => e.delayDays)).toEqual([0, 2, 3]);
            expect(specs[0]!.emails[0]!.brief).toContain("write the Meal plan itself");
            expect(specs[0]!.emails[2]!.link).toEqual({ href: "https://app.test/p/course", label: "See the details" });
            expect(specs[1]!.emails.every((e) => e.link?.href === "https://app.test/checkout/prod-1")).toBe(true);
            expect(specs[2]!.emails).toEqual([expect.objectContaining({ delayDays: 7, link: null })]);
        });

        it("a booking offer's nurture ends with the call-booking emails, and has no checkout sequences", () => {
            const specs = sequenceSpecs({ ...links, booking: true, bookingUrl: "https://cal.test/me", checkoutUrl: null });
            expect(specs.map((s) => s.kind)).toEqual(["nurture"]);
            expect(specs[0]!.emails.slice(2).map((e) => e.link)).toEqual([
                { href: "https://cal.test/me", label: "Book your call" },
                { href: "https://cal.test/me", label: "Book your call" },
            ]);
        });
    });

    it("emailHtml escapes the text into paragraphs and adds the link the code chose", () => {
        expect(emailHtml("Hi <there> & welcome\nline two\n\nSecond", { href: "https://x.test/a?b=1&c=2", label: "Go" })).toBe(
            '<p>Hi &lt;there&gt; &amp; welcome<br>line two</p>\n<p>Second</p>\n<p><a href="https://x.test/a?b=1&amp;c=2">Go</a></p>',
        );
        expect(emailHtml("Just text", null)).toBe("<p>Just text</p>");
    });

    it("asks for no links, and mentions the link only when one is added", () => {
        const [nurture] = sequenceSpecs({ ...links, booking: false });
        const first = buildEmailPrompt(["Offer: Course"], nurture!.emails[0]!, 0, 3, "nurture");
        expect(first).toContain("Offer: Course");
        expect(first).toContain("Don't include links or URLs");
        expect(first).not.toContain("the link is added below");
        expect(buildEmailPrompt([], nurture!.emails[2]!, 2, 3, "nurture")).toContain("the link is added below");
    });

    describe("ensureSequence", () => {
        const ai = (write = vi.fn(async () => 'Sure: {"subject":"Your plan","body":"Hello\\n\\nThere"}')) => ({ write, extractJson, context: ["Offer: Course"], timezone: "Asia/Kolkata" });

        it("writes each email and saves a draft campaign, a DRAFT sequence and its steps, recording the campaign on the run", async () => {
            const r = run();
            const spec = sequenceSpecs({ ...links, booking: false })[1]!;
            const writer = ai();
            expect(await ensureSequence(r, spec, writer)).toBe("camp-1");
            expect(writer.write).toHaveBeenCalledTimes(2);
            expect(mockDb.campaign.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ teamId: "team-a", ownerId: "user-1", icpId: "icp-1", name: "Spring launch: checkout reminders", status: "draft" }),
                select: { id: true },
            });
            expect(mockDb.campaignSequence.create).toHaveBeenCalledWith({
                data: { teamId: "team-a", campaignId: "camp-1", name: "Spring launch: checkout reminders", status: "DRAFT", timezone: "Asia/Kolkata", funnelStage: "BOFU" },
                select: { id: true },
            });
            const steps = mockDb.sequenceStep.createMany.mock.calls[0][0].data;
            expect(steps.map((s: any) => [s.stepOrder, s.stepType, s.delayDays, s.subject])).toEqual([[0, "EMAIL", 0, "Your plan"], [1, "EMAIL", 1, "Your plan"]]);
            expect(steps[0].body).toBe('<p>Hello</p>\n<p>There</p>\n<p><a href="https://app.test/checkout/prod-1">Finish your order</a></p>');
            expect(mockDb.playbookRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", status: "GENERATING" }, data: { cartAbandonCampaignId: "camp-1" } });
            expect(r.cartAbandonCampaignId).toBe("camp-1");
        });

        it("on a retry, reuses the one an earlier attempt made", async () => {
            const writer = ai();
            expect(await ensureSequence(run({ nurtureCampaignId: "camp-old" }), sequenceSpecs({ ...links, booking: false })[0]!, writer)).toBe("camp-old");
            expect(writer.write).not.toHaveBeenCalled();
            expect(mockDb.campaign.create).not.toHaveBeenCalled();
        });

        it("rolls back when the run was deleted or finished meanwhile, and fails on an unusable reply", async () => {
            mockDb.playbookRun.updateMany.mockResolvedValue({ count: 0 });
            await expect(ensureSequence(run(), sequenceSpecs({ ...links, booking: false })[2]!, ai())).rejects.toThrow(/no longer being written/);
            await expect(ensureSequence(run(), sequenceSpecs({ ...links, booking: false })[2]!, ai(vi.fn(async () => "no json")))).rejects.toThrow();
        });
    });

    describe("deleteSequences", () => {
        const ids = { teamId: "team-a", nurtureCampaignId: "camp-n", cartAbandonCampaignId: "camp-c", postPurchaseCampaignId: null };

        it("deletes unused sequences and their campaigns, unpointing a switched-off product first", async () => {
            mockDb.campaignSequence.findMany.mockResolvedValueOnce([{ id: "seq-n", _count: { enrollments: 0 } }]).mockResolvedValueOnce([{ id: "seq-c", _count: { enrollments: 0 } }]);
            mockDb.product.count.mockResolvedValue(0);
            mockDb.campaign.deleteMany.mockResolvedValue({ count: 1 });
            expect(await deleteSequences(ids)).toEqual({ sequencesDeleted: 2, sequencesKept: 0 });
            expect(mockDb.product.updateMany).toHaveBeenCalledWith({
                where: { teamId: "team-a", automationsActive: false, cartAbandonSequenceId: { in: ["seq-c"] } },
                data: { cartAbandonSequenceId: null, cartAbandonHours: null },
            });
            expect(mockDb.campaignSequence.deleteMany).toHaveBeenCalledWith({ where: { teamId: "team-a", id: { in: ["seq-n"] }, enrollments: { none: {} } } });
            expect(mockDb.campaign.deleteMany).toHaveBeenCalledWith({
                where: { id: "camp-n", teamId: "team-a", sequences: { none: {} }, emails: { none: {} }, leadList: { none: {} }, sequenceEnrollments: { none: {} } },
            });
        });

        it("keeps a sequence someone joined, or one a switched-on product sends", async () => {
            mockDb.campaignSequence.findMany.mockResolvedValueOnce([{ id: "seq-n", _count: { enrollments: 4 } }]).mockResolvedValueOnce([{ id: "seq-c", _count: { enrollments: 0 } }]);
            mockDb.product.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
            expect(await deleteSequences(ids)).toEqual({ sequencesDeleted: 0, sequencesKept: 2 });
            expect(mockDb.product.updateMany).not.toHaveBeenCalled();
            expect(mockDb.campaignSequence.deleteMany).not.toHaveBeenCalled();
            expect(mockDb.campaign.deleteMany).not.toHaveBeenCalled();
        });
    });
});
