import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => {
    const db: any = {
        team: { findUnique: vi.fn() },
        iCP: { findFirst: vi.fn() },
        campaign: { create: vi.fn() },
        campaignSequence: { create: vi.fn() },
        sequenceStep: { createMany: vi.fn() },
    };
    db.$transaction = vi.fn(async (fn: any) => fn(db));
    return db;
});
vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { DRIP_PLAYBOOKS, recommendDripPlaybooks } from "../dripPlaybooks";
import { createDripDraft, DripInputError } from "../dripDraft";

describe("recommendDripPlaybooks", () => {
    it("returns every playbook, best first", () => {
        const r = recommendDripPlaybooks({}, null);
        expect(r).toHaveLength(DRIP_PLAYBOOKS.length);
        expect(r.map((x) => x.score)).toEqual([...r.map((x) => x.score)].sort((a, b) => b - a));
    });

    it("puts proposal follow-up first for a quote-based consultancy", () => {
        const r = recommendDripPlaybooks({ industry_vertical: "B2B consulting", pricing_model: "Custom quote per project", cta_language: ["Book a call"] });
        expect(r[0]!.kind).toBe("proposalFollowUp");
        expect(r.find((x) => x.kind === "noShowRecovery")!.score).toBeGreaterThan(0);
    });

    it("recommends resource nurture and link follow-up when the site offers downloads", () => {
        const r = recommendDripPlaybooks({ cta_language: ["Download the guide"] }, { buyerTitles: ["Head of Marketing"] });
        const score = (k: string) => r.find((x) => x.kind === k)!.score;
        expect(score("b2bNurture")).toBeGreaterThan(score("proposalFollowUp"));
        expect(score("linkClickFollowUp")).toBeGreaterThan(0);
    });

    it("has unique kinds, and only manual playbooks are non-automatic", () => {
        expect(new Set(DRIP_PLAYBOOKS.map((p) => p.kind)).size).toBe(DRIP_PLAYBOOKS.length);
        for (const p of DRIP_PLAYBOOKS) expect(p.trigger.automatic).toBe(p.trigger.kind !== "manual");
    });

    it("recommends event reminders for a webinar site and trial nudges for a SaaS trial", () => {
        const score = (r: ReturnType<typeof recommendDripPlaybooks>, k: string) => r.find((x) => x.kind === k)!.score;
        const event = recommendDripPlaybooks({ cta_language: ["Register for the webinar"] });
        expect(score(event, "eventReminders")).toBeGreaterThan(0);
        expect(score(recommendDripPlaybooks({}), "eventReminders")).toBe(0);
        const saas = recommendDripPlaybooks({ industry_vertical: "B2B SaaS", cta_language: ["Start free trial"] });
        expect(score(saas, "trialOnboarding")).toBeGreaterThan(0);
        expect(score(recommendDripPlaybooks({ industry_vertical: "Dental clinic" }), "trialOnboarding")).toBe(0);
    });

    it("every playbook stops on reply, booking and unsubscribe", () => {
        for (const p of DRIP_PLAYBOOKS) expect(p.exits).toEqual(expect.arrayContaining(["replied", "meeting_booked", "unsubscribed"]));
    });
});

describe("createDripDraft", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.team.findUnique.mockResolvedValue({
            aiConfig: { calendarLink: "https://cal.example.com/me", companyProfile: { company_name: "Acme", value_proposition: "We fix leaky funnels" } },
        });
        mockDb.iCP.findFirst.mockResolvedValue({ id: "icp1", criteria: { buyerTitles: ["Founder"] } });
        mockDb.campaign.create.mockResolvedValue({ id: "c1" });
        mockDb.campaignSequence.create.mockResolvedValue({ id: "s1" });
    });

    const writer = vi.fn(async () => JSON.stringify({ subject: "Hi", body: "Hello there\n\nSecond paragraph" }));

    it("saves a draft sequence with timed steps and links only from team URLs", async () => {
        const out = await createDripDraft(
            { teamId: "t1", userId: "u1", kind: "welcome", links: { assetUrl: "https://acme.test/guide.pdf", assetLabel: "Get the guide" } },
            writer,
        );
        expect(out).toEqual({ campaignId: "c1", sequenceId: "s1", emails: 4 });
        expect(mockDb.campaign.create.mock.calls[0]![0].data).toMatchObject({ teamId: "t1", status: "draft", icpId: "icp1" });
        expect(mockDb.campaignSequence.create.mock.calls[0]![0].data.status).toBe("DRAFT");
        const steps = mockDb.sequenceStep.createMany.mock.calls[0]![0].data;
        expect(steps.map((s: any) => s.delayDays)).toEqual([0, 2, 4, 7]);
        expect(steps[0].body).toContain('href="https://acme.test/guide.pdf"');
        expect(steps[1].body).not.toContain("href"); // reply CTA carries no link
        expect(steps[2].body).toContain('href="https://cal.example.com/me"'); // booking from the saved calendar link
    });

    it("leaves out the link when the team gave none", async () => {
        mockDb.team.findUnique.mockResolvedValue({ aiConfig: {} });
        await createDripDraft({ teamId: "t1", userId: "u1", kind: "welcome" }, writer);
        const steps = mockDb.sequenceStep.createMany.mock.calls[0]![0].data;
        expect(steps.every((s: any) => !s.body.includes("href"))).toBe(true);
    });

    it("ignores non-http links", async () => {
        await createDripDraft({ teamId: "t1", userId: "u1", kind: "welcome", links: { assetUrl: "javascript:alert(1)" } }, writer);
        expect(mockDb.sequenceStep.createMany.mock.calls[0]![0].data[0].body).not.toContain("javascript:");
    });

    it("saves nothing when a model reply is unusable", async () => {
        await expect(createDripDraft({ teamId: "t1", userId: "u1", kind: "welcome" }, async () => "not json")).rejects.toThrow();
        expect(mockDb.campaign.create).not.toHaveBeenCalled();
    });

    it("rejects an unknown playbook", async () => {
        await expect(createDripDraft({ teamId: "t1", userId: "u1", kind: "nope" }, writer)).rejects.toBeInstanceOf(DripInputError);
    });
});
