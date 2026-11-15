import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, enrollPlanNurture, mergeSocial, sendInstantConfirmation } = vi.hoisted(() => ({
    mockPrisma: {
        landingLead: { findFirst: vi.fn() },
        lead: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    },
    enrollPlanNurture: vi.fn(),
    mergeSocial: vi.fn(),
    sendInstantConfirmation: vi.fn(),
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
vi.mock("@/modules/landing-agent/instantConfirmation", () => ({ sendInstantConfirmation }));

import { handleLandingLeadIntake } from "./landing-lead-intake-worker";

const landingLead = (over: Record<string, unknown> = {}) => ({
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
    rawPayload: {},
    campaign: { linkedCampaignId: null },
    landingPage: { slug: "guide", team: { name: "Team" }, instantConfirmation: { enabled: true, sequenceId: "seq-1" } },
    ...over,
});

describe("landing lead intake: instant confirmation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        enrollPlanNurture.mockResolvedValue(null);
        sendInstantConfirmation.mockResolvedValue(undefined);
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-new" });
    });

    it("reads the page's switch with the landing page", async () => {
        mockPrisma.landingLead.findFirst.mockResolvedValue(landingLead());
        await handleLandingLeadIntake({ teamId: "team-1", landingLeadId: "ll-1" } as never);
        const call = mockPrisma.landingLead.findFirst.mock.calls[0][0];
        expect(call.include.landingPage.select).toMatchObject({ instantConfirmation: true });
    });

    it("sends once on the new-lead path", async () => {
        mockPrisma.landingLead.findFirst.mockResolvedValue(landingLead());
        const result = await handleLandingLeadIntake({ teamId: "team-1", landingLeadId: "ll-1" } as never);
        expect(result).toEqual({ created: true, leadId: "lead-new" });
        expect(sendInstantConfirmation).toHaveBeenCalledTimes(1);
        expect(sendInstantConfirmation).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-1" }), "lead-new");
    });

    it("sends once on the existing-lead path", async () => {
        mockPrisma.landingLead.findFirst.mockResolvedValue(landingLead());
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-existing", fullName: null, phone: null, company: null, jobTitle: null, source: "csv_import", campaignId: null });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
        await handleLandingLeadIntake({ teamId: "team-1", landingLeadId: "ll-1" } as never);
        expect(sendInstantConfirmation).toHaveBeenCalledTimes(1);
        expect(sendInstantConfirmation).toHaveBeenCalledWith(expect.anything(), "lead-existing");
    });

    it("sends once on the social-merge path", async () => {
        mockPrisma.landingLead.findFirst.mockResolvedValue(landingLead({ socialToken: "tok" }));
        mergeSocial.mockResolvedValue("lead-merged");
        const result = await handleLandingLeadIntake({ teamId: "team-1", landingLeadId: "ll-1" } as never);
        expect(result).toEqual({ created: false, leadId: "lead-merged", merged: true });
        expect(sendInstantConfirmation).toHaveBeenCalledTimes(1);
        expect(sendInstantConfirmation).toHaveBeenCalledWith(expect.anything(), "lead-merged");
    });

    it("a failing confirmation never fails the intake", async () => {
        mockPrisma.landingLead.findFirst.mockResolvedValue(landingLead());
        sendInstantConfirmation.mockRejectedValueOnce(new Error("boom"));
        const result = await handleLandingLeadIntake({ teamId: "team-1", landingLeadId: "ll-1" } as never);
        expect(result).toEqual({ created: true, leadId: "lead-new" });
    });
});
