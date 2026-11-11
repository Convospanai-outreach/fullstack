import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, enrollInNurture, stopEnrollmentsForLead } = vi.hoisted(() => ({
    db: {
        campaign: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
        campaignSequence: { findFirst: vi.fn() },
        lead: { findFirst: vi.fn(), findMany: vi.fn() },
        suppressionEntry: { findFirst: vi.fn() },
        sequenceEnrollment: { count: vi.fn(), findMany: vi.fn() },
        emailEvent: { findMany: vi.fn() },
        trackedLink: { findMany: vi.fn() },
    } as any,
    enrollInNurture: vi.fn(),
    stopEnrollmentsForLead: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/modules/creator-funnel/nurtureProvider", () => ({ enrollInNurture }));
vi.mock("@/modules/email-campaigner/service/sequenceService", () => ({ SequenceService: { stopEnrollmentsForLead } }));

import { enrollDrip, enrollDripOnSignup, runLinkClickTrigger, runWinBackTrigger, WIN_BACK_PER_RUN } from "../dripTriggers";

const NOW = new Date("2026-11-11T12:00:00Z");
const campaign = (trigger: string, rule: object = {}, extra: object = {}) => ({
    id: "d1",
    teamId: "t1",
    aiConfig: { dripPlaybook: { kind: "x", trigger, active: true, rule, ...extra } },
});
const goodLead = { email: "A@x.com", status: "NEW", pipelineState: "COLD", consentObtained: true };

beforeEach(() => {
    vi.resetAllMocks();
    db.campaignSequence.findFirst.mockResolvedValue({ id: "seq1" });
    db.lead.findFirst.mockResolvedValue(goodLead);
    db.suppressionEntry.findFirst.mockResolvedValue(null);
    db.sequenceEnrollment.count.mockResolvedValue(0);
    db.sequenceEnrollment.findMany.mockResolvedValue([]);
});

describe("enrollDrip", () => {
    const c = { id: "d1", teamId: "t1" };
    it("enrolls an eligible lead", async () => {
        expect(await enrollDrip(c, "l1", { requireConsent: false })).toBeNull();
        expect(enrollInNurture).toHaveBeenCalledWith("t1", "l1", "seq1");
    });
    it.each([
        ["replied lead", { status: "replied" }],
        ["do-not-contact lead", { status: "DNC" }],
        ["booked lead", { pipelineState: "MEETING_BOOKED" }],
        ["lead without email", { email: null }],
    ])("skips a %s", async (_n, patch) => {
        db.lead.findFirst.mockResolvedValue({ ...goodLead, ...patch });
        expect(await enrollDrip(c, "l1", { requireConsent: false })).not.toBeNull();
        expect(enrollInNurture).not.toHaveBeenCalled();
    });
    it("skips a suppressed email, a missing consent when required, and a repeat", async () => {
        db.suppressionEntry.findFirst.mockResolvedValue({ id: "s" });
        expect(await enrollDrip(c, "l1", { requireConsent: false })).toBe("email is suppressed");
        db.suppressionEntry.findFirst.mockResolvedValue(null);
        db.lead.findFirst.mockResolvedValue({ ...goodLead, consentObtained: false });
        expect(await enrollDrip(c, "l1", { requireConsent: true })).toBe("no consent recorded");
        db.lead.findFirst.mockResolvedValue(goodLead);
        db.sequenceEnrollment.count.mockResolvedValue(1);
        expect(await enrollDrip(c, "l1", { requireConsent: false })).toMatch(/already went/);
        expect(enrollInNurture).not.toHaveBeenCalled();
    });
    it("leaves a lead in another sequence alone unless it is the campaign whose link was clicked", async () => {
        db.sequenceEnrollment.findMany.mockResolvedValue([{ campaignId: "other" }]);
        expect(await enrollDrip(c, "l1", { requireConsent: false })).toBe("lead is already in a sequence");
        expect(await enrollDrip(c, "l1", { requireConsent: false, replaceCampaignId: "src" })).toBe("lead is already in a sequence");
        db.sequenceEnrollment.findMany.mockResolvedValue([{ campaignId: "src" }]);
        expect(await enrollDrip(c, "l1", { requireConsent: false, replaceCampaignId: "src" })).toBeNull();
        expect(stopEnrollmentsForLead).toHaveBeenCalledWith("t1", "l1", "EXIT_DRIP_INTEREST");
    });
});

describe("enrollDripOnSignup", () => {
    it("enrolls the sign-up through the playbook for its page, and needs the consent box ticked when there is one", async () => {
        db.campaign.findMany.mockResolvedValue([campaign("landing_signup", { landingPageId: "pageA" })]);
        expect(await enrollDripOnSignup({ teamId: "t1", landingPageId: "pageB" }, "l1")).toBe("no playbook for this page");
        expect(await enrollDripOnSignup({ teamId: "t1", landingPageId: "pageA" }, "l1")).toBeNull();
        expect(enrollInNurture).toHaveBeenCalledTimes(1);
        enrollInNurture.mockClear();
        const unticked = { teamId: "t1", landingPageId: "pageA", rawPayload: { consent: { given: false } } };
        expect(await enrollDripOnSignup(unticked, "l1")).toBe("consent not given");
        expect(enrollInNurture).not.toHaveBeenCalled();
    });
});

describe("runLinkClickTrigger", () => {
    it("starts the follow-up for a real click on the chosen link, ignores scanner-fast clicks, and moves the cursor", async () => {
        db.campaign.findMany.mockResolvedValue([campaign("link_click", { url: "https://acme.test/brochure.pdf" }, { cursor: "2026-11-11T11:00:00Z" })]);
        const linkCreated = new Date(NOW.getTime() - 3_600_000);
        db.emailEvent.findMany.mockResolvedValue([
            { leadId: "human", campaignId: "src", createdAt: new Date(NOW.getTime() - 60_000), payload: { linkId: "L1" } },
            { leadId: "bot", campaignId: "src", createdAt: new Date(NOW.getTime() - 30_000), payload: { linkId: "L2" } },
            { leadId: "other", campaignId: "src", createdAt: new Date(NOW.getTime() - 20_000), payload: { linkId: "L3" } },
        ]);
        db.trackedLink.findMany.mockResolvedValue([
            { id: "L1", createdAt: linkCreated },
            { id: "L2", createdAt: new Date(NOW.getTime() - 30_000 - 5_000) }, // clicked 5 s after it was made
        ]); // L3 points elsewhere, so the query did not return it
        db.campaign.findUnique.mockResolvedValue(campaign("link_click", {}, {}));
        const out = await runLinkClickTrigger(NOW);
        expect(out.enrolled).toBe(1);
        expect(enrollInNurture).toHaveBeenCalledTimes(1);
        expect(enrollInNurture).toHaveBeenCalledWith("t1", "human", "seq1");
        expect(db.trackedLink.findMany.mock.calls[0]![0].where.destinationUrl).toEqual({ startsWith: "https://acme.test/brochure.pdf" });
        const saved = db.campaign.update.mock.calls[0]![0].data.aiConfig.dripPlaybook.cursor;
        expect(saved).toBe(NOW.toISOString());
    });
    it("does nothing without a link rule", async () => {
        db.campaign.findMany.mockResolvedValue([campaign("link_click", {})]);
        expect((await runLinkClickTrigger(NOW)).enrolled).toBe(0);
        expect(db.emailEvent.findMany).not.toHaveBeenCalled();
    });
});

describe("runWinBackTrigger", () => {
    it("asks for consented contacts quiet for 90 days and starts at most the daily cap", async () => {
        db.campaign.findMany.mockResolvedValue([campaign("inactivity")]);
        db.lead.findMany.mockResolvedValue(Array.from({ length: WIN_BACK_PER_RUN * 2 }, (_, i) => ({ id: `l${i}` })));
        const out = await runWinBackTrigger(NOW);
        expect(out.enrolled).toBe(WIN_BACK_PER_RUN);
        const where = db.lead.findMany.mock.calls[0]![0].where;
        expect(where.consentObtained).toBe(true);
        expect(where.emailEvents.none.createdAt.gte.toISOString()).toBe("2026-08-13T12:00:00.000Z");
        expect(where.emails.some.createdAt.lt.toISOString()).toBe("2026-08-13T12:00:00.000Z");
    });
});
