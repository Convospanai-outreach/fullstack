import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, nurture, isSuppressed, checkTemplate, logger } = vi.hoisted(() => ({
    mockDb: {
        campaignSequence: { findFirst: vi.fn(), findMany: vi.fn() },
        lead: { findFirst: vi.fn() },
    },
    nurture: { enrollInNurture: vi.fn(), status: vi.fn() },
    isSuppressed: vi.fn(),
    checkTemplate: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/logger", () => ({ logger }));
vi.mock("@/modules/creator-funnel/nurtureProvider", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/modules/creator-funnel/nurtureProvider")>()),
    enrollInNurture: nurture.enrollInNurture,
    teamNurtureProvider: async () => ({ status: nurture.status }),
}));
vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({ isSuppressed }));
vi.mock("@/modules/whatsapp/whatsappTemplates", () => ({ checkTemplate }));

import { checkConfirmationSequence, instantConfirmationOf, listInstantConfirmationSequences, sendInstantConfirmation } from "./instantConfirmation";

const TEAM = "team-a";
const emailStep = { stepType: "EMAIL", subject: "Welcome", body: "Hi there", whatsappTemplateName: null, whatsappTemplateLanguage: null };
const whatsappStep = { stepType: "WHATSAPP", subject: null, body: "Ada", whatsappTemplateName: "welcome_tpl", whatsappTemplateLanguage: "en" };
const sequence = (over: Record<string, unknown> = {}) => ({
    id: "seq-1",
    status: "DRAFT",
    senderMailboxIds: ["mb-1"],
    steps: [emailStep],
    ...over,
});

const CONSENT_GIVEN = { given: true, text: "I agree.", at: "2026-11-01T10:00:00.000Z", pageSlug: "guide", source: "landing_form" };
const landingLead = (setting: unknown, rawPayload: unknown = { name: "Ada" }) => ({
    teamId: TEAM,
    rawPayload,
    landingPage: { instantConfirmation: setting },
});
const ON = { enabled: true, sequenceId: "seq-1" };
const LEAD = { email: "ada@example.com", phone: "+15550001", status: "NEW", whatsappConsent: false };

describe("instantConfirmationOf", () => {
    it("reads a switched-on setting and treats every other value as off", () => {
        expect(instantConfirmationOf(ON)).toEqual(ON);
        expect(instantConfirmationOf({ enabled: false, sequenceId: "" })).toBeNull();
        expect(instantConfirmationOf({ enabled: true, sequenceId: "" })).toBeNull();
        expect(instantConfirmationOf(null)).toBeNull();
        expect(instantConfirmationOf("yes")).toBeNull();
    });
});

describe("checkConfirmationSequence (save time)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.campaignSequence.findFirst.mockImplementation(async ({ where }: any) => (where.teamId === TEAM ? sequence() : null));
        checkTemplate.mockResolvedValue({ ok: true });
    });

    it("accepts one active email step with a body and a sender mailbox", async () => {
        expect(await checkConfirmationSequence(TEAM, "seq-1")).toEqual({ ok: true, channel: "email" });
    });

    it("looks the sequence up scoped to the team", async () => {
        await checkConfirmationSequence(TEAM, "seq-1");
        expect(mockDb.campaignSequence.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "seq-1", teamId: TEAM } }));
    });

    it("refuses a sequence that belongs to another team", async () => {
        const result = await checkConfirmationSequence("team-b", "seq-1");
        expect(result.ok).toBe(false);
    });

    it("refuses a sequence with no active step, or with two", async () => {
        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ steps: [] }));
        expect((await checkConfirmationSequence(TEAM, "seq-1")).ok).toBe(false);
        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ steps: [emailStep, emailStep] }));
        expect((await checkConfirmationSequence(TEAM, "seq-1")).ok).toBe(false);
    });

    it("refuses an archived sequence", async () => {
        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ status: "ARCHIVED" }));
        expect((await checkConfirmationSequence(TEAM, "seq-1")).ok).toBe(false);
    });

    it("refuses a paused or stopped sequence, so a lead's sign-up cannot restart it", async () => {
        for (const status of ["PAUSED", "STOPPED"]) {
            mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ status }));
            expect((await checkConfirmationSequence(TEAM, "seq-1")).ok).toBe(false);
        }
    });

    it("refuses a step that is neither an email nor an approved WhatsApp template", async () => {
        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ steps: [{ ...emailStep, stepType: "DELAY" }] }));
        expect((await checkConfirmationSequence(TEAM, "seq-1")).ok).toBe(false);
        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ steps: [{ ...whatsappStep, whatsappTemplateName: null }] }));
        expect((await checkConfirmationSequence(TEAM, "seq-1")).ok).toBe(false);
    });

    it("refuses an email step with no body, and an email sequence with no sender mailbox", async () => {
        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ steps: [{ ...emailStep, body: "  " }] }));
        expect((await checkConfirmationSequence(TEAM, "seq-1")).ok).toBe(false);
        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ senderMailboxIds: [] }));
        expect((await checkConfirmationSequence(TEAM, "seq-1")).ok).toBe(false);
    });

    it("accepts a WhatsApp template step the account has approved, and refuses one it has not", async () => {
        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ steps: [whatsappStep] }));
        expect(await checkConfirmationSequence(TEAM, "seq-1")).toEqual({ ok: true, channel: "whatsapp" });
        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ steps: [whatsappStep] }));
        checkTemplate.mockResolvedValueOnce({ ok: false, reason: "Template not approved" });
        expect((await checkConfirmationSequence(TEAM, "seq-1")).ok).toBe(false);
    });
});

describe("listInstantConfirmationSequences (picker)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.campaignSequence.findMany.mockResolvedValue([
            { id: "seq-email", name: "Welcome", status: "ACTIVE", steps: [emailStep] },
            { id: "seq-wa", name: "WhatsApp hello", status: "DRAFT", steps: [whatsappStep] },
            { id: "seq-empty", name: "No steps", status: "DRAFT", steps: [] },
            { id: "seq-two", name: "Two steps", status: "ACTIVE", steps: [emailStep, emailStep] },
            { id: "seq-delay", name: "Delay only", status: "ACTIVE", steps: [{ ...emailStep, stepType: "DELAY" }] },
            { id: "seq-paused", name: "Paused", status: "PAUSED", steps: [emailStep] },
            { id: "seq-archived", name: "Archived", status: "ARCHIVED", steps: [emailStep] },
        ]);
    });

    it("lists only the team's sequences that can be sent, with their channel", async () => {
        expect(await listInstantConfirmationSequences(TEAM)).toEqual([
            { id: "seq-email", name: "Welcome", channel: "email" },
            { id: "seq-wa", name: "WhatsApp hello", channel: "whatsapp" },
        ]);
    });

    it("queries only the caller's team and checks no WhatsApp templates", async () => {
        await listInstantConfirmationSequences(TEAM);
        expect(mockDb.campaignSequence.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: TEAM } }));
        expect(checkTemplate).not.toHaveBeenCalled();
    });
});

describe("sendInstantConfirmation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.campaignSequence.findFirst.mockResolvedValue(sequence());
        mockDb.lead.findFirst.mockResolvedValue(LEAD);
        nurture.status.mockResolvedValue({ active: false });
        nurture.enrollInNurture.mockResolvedValue({ owner: "CMF" });
        isSuppressed.mockResolvedValue(false);
        checkTemplate.mockResolvedValue({ ok: true });
    });

    it("does nothing while the page's switch is off", async () => {
        await sendInstantConfirmation(landingLead(null), "lead-1");
        await sendInstantConfirmation(landingLead({ enabled: false, sequenceId: "seq-1" }), "lead-1");
        expect(mockDb.lead.findFirst).not.toHaveBeenCalled();
        expect(nurture.enrollInNurture).not.toHaveBeenCalled();
    });

    it("enrolls the lead in the chosen sequence when the form had no consent box", async () => {
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        expect(nurture.enrollInNurture).toHaveBeenCalledTimes(1);
        expect(nurture.enrollInNurture).toHaveBeenCalledWith(TEAM, "lead-1", "seq-1");
    });

    it("enrolls when the consent box was ticked", async () => {
        await sendInstantConfirmation(landingLead(ON, { consent: CONSENT_GIVEN }), "lead-1");
        expect(nurture.enrollInNurture).toHaveBeenCalledTimes(1);
    });

    it("does not enroll when the consent box was declined", async () => {
        await sendInstantConfirmation(landingLead(ON, { consent: { ...CONSENT_GIVEN, given: false } }), "lead-1");
        expect(nurture.enrollInNurture).not.toHaveBeenCalled();
    });

    it("does not enroll a do-not-contact lead or a suppressed address", async () => {
        mockDb.lead.findFirst.mockResolvedValueOnce({ ...LEAD, status: "DNC" });
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        expect(nurture.enrollInNurture).not.toHaveBeenCalled();
        isSuppressed.mockResolvedValueOnce(true);
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        expect(isSuppressed).toHaveBeenCalledWith(TEAM, "ada@example.com");
        expect(nurture.enrollInNurture).not.toHaveBeenCalled();
    });

    it("does not enroll an email sequence for a lead without an address", async () => {
        mockDb.lead.findFirst.mockResolvedValueOnce({ ...LEAD, email: null });
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        expect(nurture.enrollInNurture).not.toHaveBeenCalled();
    });

    it("sends a WhatsApp sequence only to a lead with WhatsApp consent and a phone", async () => {
        mockDb.campaignSequence.findFirst.mockResolvedValue(sequence({ steps: [whatsappStep] }));
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        expect(nurture.enrollInNurture).not.toHaveBeenCalled();
        mockDb.lead.findFirst.mockResolvedValueOnce({ ...LEAD, whatsappConsent: true });
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        expect(nurture.enrollInNurture).toHaveBeenCalledTimes(1);
    });

    it("skips when the lead is already in a live sequence (plan nurture or an earlier run)", async () => {
        nurture.status.mockResolvedValueOnce({ active: true });
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        expect(nurture.enrollInNurture).not.toHaveBeenCalled();
    });

    it("a retry after a successful enrollment does not enroll the lead twice", async () => {
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        nurture.status.mockResolvedValueOnce({ active: true });
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        expect(nurture.enrollInNurture).toHaveBeenCalledTimes(1);
    });

    it("does not send when the sequence changed to something that is not one active step", async () => {
        mockDb.campaignSequence.findFirst.mockResolvedValueOnce(sequence({ steps: [emailStep, emailStep] }));
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        expect(nurture.enrollInNurture).not.toHaveBeenCalled();
    });

    it("never throws: a failed enrollment is logged and the intake carries on", async () => {
        nurture.enrollInNurture.mockRejectedValueOnce(new Error("boom"));
        await expect(sendInstantConfirmation(landingLead(ON), "lead-1")).resolves.toBeUndefined();
        expect(logger.warn).toHaveBeenCalled();
    });

    it("a later send after the first enrollment has ended passes the same sequence; the unique key (skipDuplicates) is the guard", async () => {
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        await sendInstantConfirmation(landingLead(ON), "lead-1");
        expect(nurture.enrollInNurture.mock.calls).toEqual([[TEAM, "lead-1", "seq-1"], [TEAM, "lead-1", "seq-1"]]);
    });

    it("never throws when the lead lookup fails", async () => {
        mockDb.lead.findFirst.mockRejectedValueOnce(new Error("db down"));
        await expect(sendInstantConfirmation(landingLead(ON), "lead-1")).resolves.toBeUndefined();
        expect(nurture.enrollInNurture).not.toHaveBeenCalled();
    });
});
