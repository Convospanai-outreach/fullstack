import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, enrollPlanNurture, mergeSocial } = vi.hoisted(() => ({
    mockPrisma: {
        landingLead: { findFirst: vi.fn() },
        campaignSequence: { findFirst: vi.fn() },
        lead: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    },
    enrollPlanNurture: vi.fn(),
    mergeSocial: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/scoring", () => ({ leadScoringService: { scoreAndPersist: vi.fn() } }));
vi.mock("@/modules/mautic-integration/service/mauticService", () => ({ mauticService: { pushLead: vi.fn().mockResolvedValue({ status: "skipped" }) } }));
vi.mock("@/modules/creator-funnel/featureGate", () => ({ isCreatorFunnelEnabled: vi.fn().mockResolvedValue(false) }));
vi.mock("@/modules/creator-funnel/playbookSwitches", () => ({ enrollPlanNurture }));
vi.mock("@/modules/creator-funnel/socialLinkMerge", () => ({ mergeSignupIntoSocialLead: mergeSocial }));
vi.mock("@/modules/lead-properties/leadCustomFields", () => ({ saveLandingAnswersToLead: vi.fn().mockResolvedValue(undefined) }));

import { handleLandingLeadIntake } from "./landing-lead-intake-worker";

const CONSENT_GIVEN = { given: true, text: "I agree.", at: "2026-11-01T10:00:00.000Z", pageSlug: "guide", source: "landing_form" };
const CONSENT_DECLINED = { ...CONSENT_GIVEN, given: false };

function landingLead(rawPayload: unknown) {
    return {
        id: "ll-1",
        teamId: "team-1",
        landingPageId: "lp-1",
        campaignId: "lc-1",
        email: "ada@example.com",
        name: "Ada",
        phone: null,
        company: null,
        title: null,
        utmContent: null,
        socialToken: null,
        whatsappConsent: null,
        rawPayload,
        campaign: { linkedCampaignId: null },
        landingPage: { slug: "guide", team: { name: "Team" } },
    };
}

function run(rawPayload: unknown) {
    mockPrisma.landingLead.findFirst.mockResolvedValue(landingLead(rawPayload));
    return handleLandingLeadIntake({ teamId: "team-1", landingLeadId: "ll-1" } as never);
}

describe("landing lead intake and consent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        enrollPlanNurture.mockResolvedValue(null);
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });
    });

    it("marks a new Lead as consenting when the landing form recorded consent", async () => {
        await run({ answers: {}, consent: CONSENT_GIVEN });
        expect(mockPrisma.lead.create.mock.calls[0]![0].data).toMatchObject({ consentObtained: true });
    });

    it("does not mark a new Lead as consenting when consent was declined or not asked", async () => {
        await run({ consent: CONSENT_DECLINED });
        expect(mockPrisma.lead.create.mock.calls[0]![0].data.consentObtained).not.toBe(true);
        vi.clearAllMocks();
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-2" });
        enrollPlanNurture.mockResolvedValue(null);
        await run(null);
        expect(mockPrisma.lead.create.mock.calls[0]![0].data.consentObtained).not.toBe(true);
    });

    it("sets consentObtained on an existing Lead only to true, never to false", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", campaignId: null, fullName: "Ada", phone: null, company: null, jobTitle: null, source: "landing_page", consentObtained: true });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
        await run({ consent: CONSENT_GIVEN });
        expect(mockPrisma.lead.updateMany.mock.calls[0]![0].data).toMatchObject({ consentObtained: true });

        vi.clearAllMocks();
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", campaignId: null, fullName: "Ada", phone: null, company: null, jobTitle: null, source: "landing_page", consentObtained: true });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
        enrollPlanNurture.mockResolvedValue(null);
        await run({ consent: CONSENT_DECLINED });
        expect(mockPrisma.lead.updateMany.mock.calls[0]![0].data).not.toHaveProperty("consentObtained");
    });

    it("does not enrol a lead in plan nurture when the form's consent was declined", async () => {
        await run({ consent: CONSENT_DECLINED });
        expect(enrollPlanNurture).not.toHaveBeenCalled();
    });

    it("enrols in plan nurture when consent was given, or the page had no consent block", async () => {
        await run({ consent: CONSENT_GIVEN });
        expect(enrollPlanNurture).toHaveBeenCalledTimes(1);
        vi.clearAllMocks();
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-3" });
        enrollPlanNurture.mockResolvedValue(null);
        await run(null);
        expect(enrollPlanNurture).toHaveBeenCalledTimes(1);
    });
});

describe("social sign-ups and opted-out leads", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        enrollPlanNurture.mockResolvedValue(null);
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
        mergeSocial.mockResolvedValue("lead-9");
    });

    function runSocial(rawPayload: unknown) {
        mockPrisma.landingLead.findFirst.mockResolvedValue({ ...landingLead(rawPayload), socialToken: "signed-token" });
        return handleLandingLeadIntake({ teamId: "team-1", landingLeadId: "ll-1" } as never);
    }

    it("records consent on the lead a social sign-up joined, when it was given", async () => {
        await runSocial({ consent: CONSENT_GIVEN });
        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-9", teamId: "team-1", status: { not: "DNC" } },
            data: { consentObtained: true },
        });
    });

    it("does not record consent on a joined lead when it was declined", async () => {
        await runSocial({ consent: CONSENT_DECLINED });
        expect(mockPrisma.lead.updateMany.mock.calls.some(([args]) => "consentObtained" in (args as { data: object }).data)).toBe(false);
    });

    it("does not give an opted-out (DNC) lead consent again when it submits a ticked form", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", campaignId: null, fullName: "Ada", phone: null, company: null, jobTitle: null, source: "landing_page", status: "DNC", consentObtained: false });
        await run({ consent: CONSENT_GIVEN });
        expect(mockPrisma.lead.updateMany.mock.calls[0]![0].data).not.toHaveProperty("consentObtained");
    });
});
