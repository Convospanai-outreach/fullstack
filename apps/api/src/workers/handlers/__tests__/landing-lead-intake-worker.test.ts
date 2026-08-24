import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        landingLead: {
            findFirst: vi.fn(),
        },
        lead: {
            findFirst: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        },
    },
}));

vi.mock("@/modules/scoring", () => ({
    leadScoringService: {
        scoreAndPersist: vi.fn(),
    },
}));

import { prisma } from "@/lib/db";
import { leadScoringService } from "@/modules/scoring";
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
        (prisma.lead.update as any).mockResolvedValue({ id: "lead-existing" });

        const result = await handleLandingLeadIntake({ landingLeadId: "ll-2", teamId: "team-1" } as any);

        expect(prisma.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-existing" },
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
});
