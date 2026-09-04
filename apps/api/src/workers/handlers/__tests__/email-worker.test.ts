import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: { findUnique: vi.fn() },
        campaign: { findUnique: vi.fn(), update: vi.fn() },
        activity: { create: vi.fn() },
    },
}));

vi.mock("@/modules/email-campaigner", () => ({
    emailService: { sendEmail: vi.fn() },
}));

vi.mock("@/lib/aiService", () => ({
    aiService: { generateEmailDraft: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    logWorker: vi.fn(),
}));

vi.mock("@/lib/crm/leadStageTransitions", () => ({
    advanceLeadAfterEmailSent: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { emailService } from "@/modules/email-campaigner";
import { aiService } from "@/lib/aiService";
import { handleEmailSend } from "../email-worker";

describe("email-worker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (aiService.generateEmailDraft as any).mockResolvedValue({ subject: "Hi", body: "Body" });
        (emailService.sendEmail as any).mockResolvedValue({ providerId: "msg-1" });
        (prisma.campaign.update as any).mockResolvedValue({});
        (prisma.activity.create as any).mockResolvedValue({});
    });

    it("throws when leadId or campaignId is missing", async () => {
        await expect(handleEmailSend({ leadId: "lead-1" } as any)).rejects.toThrow(
            "Missing leadId or campaignId in email job payload"
        );
    });

    it("refuses to email a lead that doesn't belong to the payload's teamId, even though the campaign matches", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-b", email: "a@b.com" });
        (prisma.campaign.findUnique as any).mockResolvedValue({ id: "campaign-1", teamId: "team-a" });

        await expect(
            handleEmailSend({ leadId: "lead-1", campaignId: "campaign-1", teamId: "team-a" } as any)
        ).rejects.toThrow("Lead lead-1 does not belong to team team-a");
        expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it("refuses to email via a campaign that doesn't belong to the payload's teamId, even though the lead matches", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-a", email: "a@b.com" });
        (prisma.campaign.findUnique as any).mockResolvedValue({ id: "campaign-1", teamId: "team-b" });

        await expect(
            handleEmailSend({ leadId: "lead-1", campaignId: "campaign-1", teamId: "team-a" } as any)
        ).rejects.toThrow("Campaign campaign-1 does not belong to team team-a");
        expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it("sends the email when the lead and campaign both belong to the payload's teamId", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-a", email: "a@b.com" });
        (prisma.campaign.findUnique as any).mockResolvedValue({
            id: "campaign-1",
            teamId: "team-a",
            ownerId: "user-1",
        });

        const result = await handleEmailSend({
            leadId: "lead-1",
            campaignId: "campaign-1",
            teamId: "team-a",
        } as any);

        expect(emailService.sendEmail).toHaveBeenCalled();
        expect(result).toMatchObject({ leadId: "lead-1", sent: true });
    });
});
