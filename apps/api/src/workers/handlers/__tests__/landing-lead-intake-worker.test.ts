import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        landingLead: {
            findFirst: vi.fn(),
        },
        lead: {
            findFirst: vi.fn(),
            updateMany: vi.fn(),
            create: vi.fn(),
        },
    },
}));

vi.mock("@/modules/scoring", () => ({
    leadScoringService: {
        scoreAndPersist: vi.fn(),
    },
}));

vi.mock("@/modules/creator-funnel/featureGate", () => ({ isCreatorFunnelEnabled: vi.fn().mockResolvedValue(false) }));
vi.mock("@/modules/creator-funnel/funnelStageService", () => ({ applyFunnelEvent: vi.fn() }));
vi.mock("@/modules/creator-funnel/socialLinkMerge", () => ({ mergeSignupIntoSocialLead: vi.fn() }));
vi.mock("@/modules/creator-funnel/contentRoi", () => ({ setFirstTouchPost: vi.fn() }));

import { prisma } from "@/lib/db";
import { leadScoringService } from "@/modules/scoring";
import { isCreatorFunnelEnabled } from "@/modules/creator-funnel/featureGate";
import { applyFunnelEvent } from "@/modules/creator-funnel/funnelStageService";
import { mergeSignupIntoSocialLead } from "@/modules/creator-funnel/socialLinkMerge";
import { setFirstTouchPost } from "@/modules/creator-funnel/contentRoi";
import { handleLandingLeadIntake } from "../landing-lead-intake-worker";

describe("landing-lead-intake-worker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws when landingLeadId is missing", async () => {
        await expect(handleLandingLeadIntake({ teamId: "team-1" } as any)).rejects.toThrow(
            "Landing lead identifier (landingLeadId) is missing in payload"
        );
    });

    it("throws when teamId is missing", async () => {
        await expect(handleLandingLeadIntake({ landingLeadId: "ll-1" } as any)).rejects.toThrow(
            "teamId is missing in payload"
        );
    });

    it("skips when the LandingLead row can't be found", async () => {
        (prisma.landingLead.findFirst as any).mockResolvedValue(null);

        const result = await handleLandingLeadIntake({ landingLeadId: "ll-1", teamId: "team-1" } as any);

        expect(result).toEqual({ created: false, reason: "landing_lead_not_found" });
    });

    it("creates a new Lead from a LandingLead and links the outreach campaign", async () => {
        (prisma.landingLead.findFirst as any).mockResolvedValue({
            id: "ll-1",
            teamId: "team-1",
            email: "Jane@Example.com",
            name: "Jane Doe",
            phone: "+1234",
            company: "Acme",
            title: "CEO",
            campaign: { linkedCampaignId: "campaign-1" },
        });
        (prisma.lead.findFirst as any).mockResolvedValue(null);
        (prisma.lead.create as any).mockResolvedValue({ id: "lead-1" });

        const result = await handleLandingLeadIntake({ landingLeadId: "ll-1", teamId: "team-1" } as any);

        expect(prisma.lead.create).toHaveBeenCalledWith({
            data: {
                teamId: "team-1",
                campaignId: "campaign-1",
                email: "jane@example.com",
                fullName: "Jane Doe",
                phone: "+1234",
                company: "Acme",
                jobTitle: "CEO",
                source: "landing_page",
                status: "NEW",
            },
        });
        expect(leadScoringService.scoreAndPersist).toHaveBeenCalledWith("lead-1");
        expect(result).toEqual({ created: true, leadId: "lead-1" });
    });

    it("updates an existing Lead with the same email instead of creating a duplicate", async () => {
        (prisma.landingLead.findFirst as any).mockResolvedValue({
            id: "ll-2",
            teamId: "team-1",
            email: "jane@example.com",
            name: "Jane Doe",
            phone: null,
            company: "Acme",
            title: null,
            campaign: { linkedCampaignId: null },
        });
        (prisma.lead.findFirst as any).mockResolvedValue({
            id: "lead-existing",
            fullName: null,
            phone: "+9999",
            company: null,
            jobTitle: "VP",
            source: "csv_import",
            campaignId: "old-campaign",
        });
        (prisma.lead.updateMany as any).mockResolvedValue({ count: 1 });

        const result = await handleLandingLeadIntake({ landingLeadId: "ll-2", teamId: "team-1" } as any);

        expect(prisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-existing", teamId: "team-1" },
            data: {
                campaignId: "old-campaign",
                fullName: "Jane Doe",
                phone: "+9999",
                company: "Acme",
                jobTitle: "VP",
                source: "csv_import",
            },
        });
        expect(leadScoringService.scoreAndPersist).toHaveBeenCalledWith("lead-existing");
        expect(result).toEqual({ created: false, leadId: "lead-existing" });
    });

    it("does not silently succeed if the lead was reassigned out of the team between the lookup and the write", async () => {
        (prisma.landingLead.findFirst as any).mockResolvedValue({
            id: "ll-4",
            teamId: "team-1",
            email: "jane@example.com",
            name: "Jane Doe",
            phone: null,
            company: null,
            title: null,
            campaign: { linkedCampaignId: null },
        });
        (prisma.lead.findFirst as any).mockResolvedValue({
            id: "lead-existing",
            fullName: null,
            phone: null,
            company: null,
            jobTitle: null,
            source: "csv_import",
            campaignId: null,
        });
        (prisma.lead.updateMany as any).mockResolvedValue({ count: 0 });

        const result = await handleLandingLeadIntake({ landingLeadId: "ll-4", teamId: "team-1" } as any);

        expect(leadScoringService.scoreAndPersist).not.toHaveBeenCalled();
        expect(result).toEqual({ created: false, reason: "lead_not_found" });
    });

    it("does not fail the job when post-intake scoring throws", async () => {
        (prisma.landingLead.findFirst as any).mockResolvedValue({
            id: "ll-3",
            teamId: "team-1",
            email: null,
            name: "No Email Lead",
            phone: null,
            company: null,
            title: null,
            campaign: { linkedCampaignId: null },
        });
        (prisma.lead.create as any).mockResolvedValue({ id: "lead-3" });
        (leadScoringService.scoreAndPersist as any).mockRejectedValue(new Error("scoring failed"));

        const result = await handleLandingLeadIntake({ landingLeadId: "ll-3", teamId: "team-1" } as any);

        expect(result).toEqual({ created: true, leadId: "lead-3" });
    });

    describe("creator funnel", () => {
        const optIn = () => {
            (prisma.landingLead.findFirst as any).mockResolvedValue({
                id: "ll-5",
                teamId: "team-1",
                email: null,
                name: "Asha",
                phone: null,
                company: null,
                title: null,
                campaign: { linkedCampaignId: null },
            });
            (prisma.lead.create as any).mockResolvedValue({ id: "lead-5" });
            (leadScoringService.scoreAndPersist as any).mockResolvedValue(undefined);
        };

        it("moves the lead to MOFU on opt-in when the team has the creator funnel on", async () => {
            optIn();
            (isCreatorFunnelEnabled as any).mockResolvedValue(true);

            await handleLandingLeadIntake({ landingLeadId: "ll-5", teamId: "team-1" } as any);

            expect(isCreatorFunnelEnabled).toHaveBeenCalledWith("team-1");
            expect(applyFunnelEvent).toHaveBeenCalledWith("team-1", "lead-5", "landing_opt_in");
        });

        it("leaves the stage alone for teams without the flag", async () => {
            optIn();
            (isCreatorFunnelEnabled as any).mockResolvedValue(false);

            await handleLandingLeadIntake({ landingLeadId: "ll-5", teamId: "team-1" } as any);

            expect(applyFunnelEvent).not.toHaveBeenCalled();
        });

        it("never fails the intake when the stage update throws", async () => {
            optIn();
            (isCreatorFunnelEnabled as any).mockResolvedValue(true);
            (applyFunnelEvent as any).mockRejectedValue(new Error("db down"));

            await expect(handleLandingLeadIntake({ landingLeadId: "ll-5", teamId: "team-1" } as any)).resolves.toEqual({ created: true, leadId: "lead-5" });
        });

        const linkSignUp = () => {
            const row = {
                id: "ll-6",
                teamId: "team-1",
                socialToken: "tok",
                email: "asha@example.com",
                name: "Asha",
                phone: null,
                company: null,
                title: null,
                campaign: { linkedCampaignId: "campaign-1" },
            };
            (prisma.landingLead.findFirst as any).mockResolvedValue(row);
            (leadScoringService.scoreAndPersist as any).mockResolvedValue(undefined);
            return row;
        };

        it("merges a sign-up from an auto-reply link into that person's lead and moves it to MOFU", async () => {
            const row = linkSignUp();
            (isCreatorFunnelEnabled as any).mockResolvedValue(true);
            (mergeSignupIntoSocialLead as any).mockResolvedValue("lead-social");

            await expect(handleLandingLeadIntake({ landingLeadId: "ll-6", teamId: "team-1" } as any)).resolves.toEqual({ created: false, leadId: "lead-social", merged: true });

            expect(mergeSignupIntoSocialLead).toHaveBeenCalledWith(row, "campaign-1");
            expect(prisma.lead.create).not.toHaveBeenCalled();
            expect(prisma.lead.updateMany).not.toHaveBeenCalled();
            expect(leadScoringService.scoreAndPersist).toHaveBeenCalledWith("lead-social");
            expect(applyFunnelEvent).toHaveBeenCalledWith("team-1", "lead-social", "landing_opt_in");
        });

        it("takes the normal path when the link can't be merged", async () => {
            linkSignUp();
            (mergeSignupIntoSocialLead as any).mockResolvedValue(null);
            (prisma.lead.findFirst as any).mockResolvedValue(null);
            (prisma.lead.create as any).mockResolvedValue({ id: "lead-new" });

            await expect(handleLandingLeadIntake({ landingLeadId: "ll-6", teamId: "team-1" } as any)).resolves.toEqual({ created: true, leadId: "lead-new" });
        });

        it("takes the normal path when the merge throws", async () => {
            linkSignUp();
            (mergeSignupIntoSocialLead as any).mockRejectedValue(new Error("db down"));
            (prisma.lead.findFirst as any).mockResolvedValue(null);
            (prisma.lead.create as any).mockResolvedValue({ id: "lead-new" });

            await expect(handleLandingLeadIntake({ landingLeadId: "ll-6", teamId: "team-1" } as any)).resolves.toEqual({ created: true, leadId: "lead-new" });
        });

        it("records the page's utm_content as first touch on every path (merge, existing, new)", async () => {
            const row = linkSignUp();
            (row as any).utmContent = "post-p";
            (mergeSignupIntoSocialLead as any).mockResolvedValue("lead-social");
            await handleLandingLeadIntake({ landingLeadId: "ll-6", teamId: "team-1" } as any);
            expect(setFirstTouchPost).toHaveBeenLastCalledWith("team-1", "lead-social", "post-p");

            (mergeSignupIntoSocialLead as any).mockResolvedValue(null);
            (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-existing", fullName: null, phone: null, company: null, jobTitle: null, source: "x", campaignId: null });
            (prisma.lead.updateMany as any).mockResolvedValue({ count: 1 });
            await handleLandingLeadIntake({ landingLeadId: "ll-6", teamId: "team-1" } as any);
            expect(setFirstTouchPost).toHaveBeenLastCalledWith("team-1", "lead-existing", "post-p");

            (prisma.lead.findFirst as any).mockResolvedValue(null);
            (prisma.lead.create as any).mockResolvedValue({ id: "lead-new" });
            await handleLandingLeadIntake({ landingLeadId: "ll-6", teamId: "team-1" } as any);
            expect(setFirstTouchPost).toHaveBeenLastCalledWith("team-1", "lead-new", "post-p");
        });

        it("doesn't fail the intake when first-touch attribution throws, and skips it without utm_content", async () => {
            optIn();
            (setFirstTouchPost as any).mockRejectedValue(new Error("db down"));
            await expect(handleLandingLeadIntake({ landingLeadId: "ll-5", teamId: "team-1" } as any)).resolves.toEqual({ created: true, leadId: "lead-5" });
            expect(setFirstTouchPost).not.toHaveBeenCalled();

            const row = linkSignUp();
            (row as any).utmContent = "post-p";
            (mergeSignupIntoSocialLead as any).mockResolvedValue("lead-social");
            await expect(handleLandingLeadIntake({ landingLeadId: "ll-6", teamId: "team-1" } as any)).resolves.toMatchObject({ leadId: "lead-social" });
        });

        it("doesn't try a merge for an ordinary sign-up", async () => {
            optIn();
            await handleLandingLeadIntake({ landingLeadId: "ll-5", teamId: "team-1" } as any);
            expect(mergeSignupIntoSocialLead).not.toHaveBeenCalled();
        });
    });
});
