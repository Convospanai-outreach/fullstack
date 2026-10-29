import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: { findUnique: vi.fn() },
        campaign: { findUnique: vi.fn(), update: vi.fn() },
        activity: { create: vi.fn() },
        email: { findFirst: vi.fn() },
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

vi.mock("@/modules/governance/messageApproval", async (importActual) => ({
    ...(await importActual<typeof import("@/modules/governance/messageApproval")>()),
    gateAiMessage: vi.fn(),
    flagNeedsAttention: vi.fn().mockResolvedValue(undefined),
    resolveApprovedMessage: vi.fn(),
    settleMessageApproval: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/db";
import { emailService } from "@/modules/email-campaigner";
import { aiService } from "@/lib/aiService";
import { flagNeedsAttention, gateAiMessage, resolveApprovedMessage, settleMessageApproval } from "@/modules/governance/messageApproval";
import { handleEmailSend } from "../email-worker";

describe("email-worker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (gateAiMessage as any).mockResolvedValue({ send: true });
        (flagNeedsAttention as any).mockResolvedValue(undefined);
        (settleMessageApproval as any).mockResolvedValue(undefined);
        (aiService.generateEmailDraft as any).mockResolvedValue({ subject: "Hi", body: "Body" });
        (emailService.sendEmail as any).mockResolvedValue({ providerId: "msg-1" });
        (prisma.campaign.update as any).mockResolvedValue({});
        (prisma.activity.create as any).mockResolvedValue({});
        (prisma.email.findFirst as any).mockResolvedValue(null);
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

    it("passes the campaign's linked ICP criteria into generateEmailDraft instead of null", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-a", email: "a@b.com" });
        (prisma.campaign.findUnique as any).mockResolvedValue({
            id: "campaign-1",
            teamId: "team-a",
            ownerId: "user-1",
            icp: { criteria: { personaHook: "loves automation" } },
        });

        await handleEmailSend({ leadId: "lead-1", campaignId: "campaign-1", teamId: "team-a" } as any);

        expect(aiService.generateEmailDraft).toHaveBeenCalledWith(
            expect.anything(),
            { personaHook: "loves automation" },
            "team-a"
        );
    });

    it("skips re-sending when an Email row already exists for this job's idempotency key (B-01 regression)", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-a", email: "a@b.com" });
        (prisma.campaign.findUnique as any).mockResolvedValue({ id: "campaign-1", teamId: "team-a" });
        (prisma.email.findFirst as any).mockResolvedValue({ id: "email-1", idempotencyKey: "job-1" });

        const result = await handleEmailSend(
            { leadId: "lead-1", campaignId: "campaign-1", teamId: "team-a" } as any,
            "job-1"
        );

        expect(prisma.email.findFirst).toHaveBeenCalledWith({ where: { idempotencyKey: "job-1" } });
        expect(emailService.sendEmail).not.toHaveBeenCalled();
        expect(result).toMatchObject({ sent: true, alreadySent: true });
    });

    it("passes the job id through to sendEmail as idempotencyKey", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-a", email: "a@b.com" });
        (prisma.campaign.findUnique as any).mockResolvedValue({ id: "campaign-1", teamId: "team-a" });

        await handleEmailSend({ leadId: "lead-1", campaignId: "campaign-1", teamId: "team-a" } as any, "job-1");

        expect(emailService.sendEmail).toHaveBeenCalledWith(
            "a@b.com",
            expect.any(String),
            expect.any(String),
            expect.objectContaining({ idempotencyKey: "job-1" })
        );
    });

    it("does not throw (and so does not trigger a retry that would re-send) when a post-send write fails (B-01 regression)", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-a", email: "a@b.com" });
        (prisma.campaign.findUnique as any).mockResolvedValue({ id: "campaign-1", teamId: "team-a" });
        (prisma.campaign.update as any).mockRejectedValue(new Error("db unavailable"));

        const result = await handleEmailSend(
            { leadId: "lead-1", campaignId: "campaign-1", teamId: "team-a" } as any,
            "job-1"
        );

        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ sent: true });
    });

    it("uses a precomputed draft (BATCH mode) instead of calling generateEmailDraft", async () => {
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
            precomputedDraft: { subject: "Batch subject", body: "Batch body" },
        } as any);

        expect(aiService.generateEmailDraft).not.toHaveBeenCalled();
        expect(emailService.sendEmail).toHaveBeenCalledWith(
            "a@b.com",
            "Batch subject",
            "Batch body",
            expect.anything()
        );
        expect(result).toMatchObject({ leadId: "lead-1", sent: true });
    });

    describe("approval gate", () => {
        const job = { leadId: "lead-1", campaignId: "campaign-1", teamId: "team-a" } as any;

        beforeEach(() => {
            (prisma.lead.findUnique as any).mockResolvedValue({ id: "lead-1", teamId: "team-a", email: "a@b.com" });
            (prisma.campaign.findUnique as any).mockResolvedValue({ id: "campaign-1", teamId: "team-a", ownerId: "user-1" });
        });

        it("holds an AI-written email for approval instead of sending it", async () => {
            (gateAiMessage as any).mockResolvedValue({ send: false, held: "approval", approvalId: "appr-1" });

            const result = await handleEmailSend(job, "job-1");

            expect(result).toEqual({ leadId: "lead-1", campaignId: "campaign-1", sent: false, held: "approval" });
            expect(emailService.sendEmail).not.toHaveBeenCalled();
            expect(gateAiMessage).toHaveBeenCalledWith(expect.objectContaining({ channel: "EMAIL", jobType: "email_sending", subject: "Hi", body: "Body", requesterHint: "user-1" }));
        });

        it("holds a batch-precomputed draft too, since it is AI-written", async () => {
            (gateAiMessage as any).mockResolvedValue({ send: false, held: "approval", approvalId: "appr-1" });

            await handleEmailSend({ ...job, precomputedDraft: { subject: "Batch subject", body: "Batch body" } }, "job-1");

            expect(emailService.sendEmail).not.toHaveBeenCalled();
            expect(gateAiMessage).toHaveBeenCalledWith(expect.objectContaining({ subject: "Batch subject", body: "Batch body" }));
        });

        it("retries generation twice, then flags needs-attention and sends nothing", async () => {
            (aiService.generateEmailDraft as any).mockRejectedValue(new Error("model down"));
            vi.spyOn(console, "warn").mockImplementation(() => {});

            const result = await handleEmailSend(job, "job-1");

            expect(aiService.generateEmailDraft).toHaveBeenCalledTimes(3);
            expect(result).toMatchObject({ sent: false, held: "needs_attention" });
            expect(flagNeedsAttention).toHaveBeenCalledWith(expect.objectContaining({ channel: "EMAIL", leadId: "lead-1", teamId: "team-a" }));
            expect(emailService.sendEmail).not.toHaveBeenCalled();
        });

        it("sends the approved text as approved, with an idempotency key tied to the approval, and marks it sent", async () => {
            (resolveApprovedMessage as any).mockResolvedValue({ state: "ready", subject: "Approved subject", body: "Approved body" });

            const result = await handleEmailSend({ ...job, approvedMessageId: "appr-1" }, "job-2");

            expect(aiService.generateEmailDraft).not.toHaveBeenCalled();
            expect(gateAiMessage).not.toHaveBeenCalled();
            expect(emailService.sendEmail).toHaveBeenCalledWith("a@b.com", "Approved subject", "Approved body", expect.objectContaining({ idempotencyKey: "approved_message_appr-1" }));
            expect(settleMessageApproval).toHaveBeenCalledWith("appr-1", "team-a", "SENT", undefined);
            expect(result).toMatchObject({ sent: true });
        });

        it("sends nothing when the approval is expired or already handled", async () => {
            (resolveApprovedMessage as any).mockResolvedValue({ state: "expired" });

            const result = await handleEmailSend({ ...job, approvedMessageId: "appr-1" }, "job-2");

            expect(result).toEqual({ leadId: "lead-1", campaignId: "campaign-1", sent: false, skipped: "expired" });
            expect(emailService.sendEmail).not.toHaveBeenCalled();
        });

        it("flags the approval needs-attention when the provider refuses the approved email", async () => {
            (resolveApprovedMessage as any).mockResolvedValue({ state: "ready", subject: "S", body: "B" });
            (emailService.sendEmail as any).mockResolvedValue({ success: false, error: "rejected" });

            await handleEmailSend({ ...job, approvedMessageId: "appr-1" }, "job-2");

            expect(settleMessageApproval).toHaveBeenCalledWith("appr-1", "team-a", "NEEDS_ATTENTION", expect.any(String));
        });
    });
});
