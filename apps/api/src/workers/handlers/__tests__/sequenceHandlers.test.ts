import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/linkedin/puppeteerRunner", () => ({
    runLinkedInAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findUnique: vi.fn(),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        campaignVariant: {
            findFirst: vi.fn().mockResolvedValue(null),
            update: vi.fn().mockResolvedValue({}),
        },
    },
}));

vi.mock("@/lib/sequenceService", () => ({
    SequenceService: { scheduleNextStep: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/aiService", () => ({
    aiService: { generateConnectionMessage: vi.fn(), askAI: vi.fn() },
}));

vi.mock("@/modules/email-campaigner/service/emailComposer", () => ({
    composeNodeA: vi.fn(),
}));

vi.mock("@/modules/email-campaigner", () => ({
    emailService: { sendEmail: vi.fn() },
}));

import { handleSequenceAction } from "../sequenceHandlers";
import { runLinkedInAction } from "@/linkedin/puppeteerRunner";
import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";
import { emailService } from "@/modules/email-campaigner";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("handleSequenceAction VISIT", () => {
    it("calls runLinkedInAction with action/profileUrl, not type/url", async () => {
        await handleSequenceAction({
            leadId: "lead-1",
            url: "https://linkedin.com/in/test-profile",
            action: "VISIT",
        });

        expect(runLinkedInAction).toHaveBeenCalledWith({
            action: "scrape",
            profileUrl: "https://linkedin.com/in/test-profile",
        });
    });

    it("rejects a VISIT for a lead belonging to another team", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
            campaign: { teamId: "other-team" },
        } as any);

        await expect(handleSequenceAction({
            leadId: "lead-foreign",
            url: "https://linkedin.com/in/foreign",
            action: "VISIT",
            teamId: "team-1",
        })).rejects.toThrow(/does not belong to team/);

        expect(runLinkedInAction).not.toHaveBeenCalled();
    });

    it("rejects a VISIT for a campaign-less lead belonging to another team (OPEN-231)", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
            teamId: "other-team",
            campaign: null,
        } as any);

        await expect(handleSequenceAction({
            leadId: "lead-foreign-no-campaign",
            url: "https://linkedin.com/in/foreign",
            action: "VISIT",
            teamId: "team-1",
        })).rejects.toThrow(/does not belong to team/);

        expect(runLinkedInAction).not.toHaveBeenCalled();
    });
});

describe("handleSequenceAction CONNECT", () => {
    it("rejects a CONNECT for a lead belonging to another team", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
            enrichedData: null,
            campaign: { teamId: "other-team" },
        } as any);

        await expect(handleSequenceAction({
            leadId: "lead-foreign",
            url: "https://linkedin.com/in/foreign",
            action: "CONNECT",
            teamId: "team-1",
        })).rejects.toThrow(/does not belong to team/);

        expect(aiService.generateConnectionMessage).not.toHaveBeenCalled();
        expect(runLinkedInAction).not.toHaveBeenCalled();
    });

    it("rejects a CONNECT for a campaign-less lead belonging to another team (OPEN-231)", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
            enrichedData: null,
            teamId: "other-team",
            campaign: null,
        } as any);

        await expect(handleSequenceAction({
            leadId: "lead-foreign-no-campaign",
            url: "https://linkedin.com/in/foreign",
            action: "CONNECT",
            teamId: "team-1",
        })).rejects.toThrow(/does not belong to team/);

        expect(aiService.generateConnectionMessage).not.toHaveBeenCalled();
        expect(runLinkedInAction).not.toHaveBeenCalled();
        expect(prisma.lead.updateMany).not.toHaveBeenCalled();
    });
});

describe("handleSequenceAction EMAIL", () => {
    it("rejects an EMAIL for a lead belonging to another team", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
            id: "lead-foreign",
            email: "foreign@example.com",
            campaign: { teamId: "other-team", team: {} },
        } as any);

        await expect(handleSequenceAction({
            leadId: "lead-foreign",
            action: "EMAIL",
            teamId: "team-1",
        })).rejects.toThrow(/does not belong to team/);

        expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it("allows an EMAIL for a lead belonging to the caller's own team", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
            id: "lead-own",
            email: "own@example.com",
            campaignId: "campaign-1",
            fullName: "Own Lead",
            campaign: { id: "campaign-1", teamId: "team-1", team: {}, aiConfig: {} },
        } as any);
        vi.mocked(emailService.sendEmail).mockResolvedValueOnce({ ok: true } as any);

        const result = await handleSequenceAction({
            leadId: "lead-own",
            action: "EMAIL",
            teamId: "team-1",
        });

        expect(emailService.sendEmail).toHaveBeenCalledWith(
            "own@example.com",
            expect.any(String),
            expect.any(String),
            expect.objectContaining({ teamId: "team-1", campaignId: "campaign-1", leadId: "lead-own" })
        );
        expect(result).toEqual({ ok: true });
        expect(prisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-own", teamId: "team-1" },
            data: { status: "EMAIL" },
        });
    });

    it("sends the selected A/B variant's own subject/body instead of composeNodeA's draft, and increments its sentCount", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce({
            id: "lead-own",
            email: "own@example.com",
            campaignId: "campaign-1",
            fullName: "Own Lead",
            campaign: { id: "campaign-1", teamId: "team-1", team: {}, aiConfig: {} },
        } as any);
        vi.mocked(prisma.campaignVariant.findFirst).mockResolvedValueOnce({
            id: "variant-1",
            campaignId: "campaign-1",
            subject: "Variant subject",
            body: "Variant body",
        } as any);
        vi.mocked(emailService.sendEmail).mockResolvedValueOnce({ ok: true } as any);

        const result = await handleSequenceAction({
            leadId: "lead-own",
            action: "EMAIL",
            teamId: "team-1",
            variantId: "variant-1",
        });

        expect(emailService.sendEmail).toHaveBeenCalledWith(
            "own@example.com",
            "Variant subject",
            "Variant body",
            expect.objectContaining({ teamId: "team-1", campaignId: "campaign-1", leadId: "lead-own" })
        );
        expect(prisma.campaignVariant.update).toHaveBeenCalledWith({
            where: { id: "variant-1" },
            data: { sentCount: { increment: 1 } },
        });
        expect(result).toEqual({ ok: true });
    });
});
