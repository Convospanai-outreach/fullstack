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
        message: { create: vi.fn().mockResolvedValue({}) },
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

vi.mock("@/modules/governance/messageApproval", async (importActual) => ({
    ...(await importActual<typeof import("@/modules/governance/messageApproval")>()),
    gateAiMessage: vi.fn(),
    flagNeedsAttention: vi.fn().mockResolvedValue(undefined),
    resolveApprovedMessage: vi.fn(),
    settleMessageApproval: vi.fn().mockResolvedValue(undefined),
}));

import { handleSequenceAction } from "../sequenceHandlers";
import { SequenceService } from "@/lib/sequenceService";
import { composeNodeA } from "@/modules/email-campaigner/service/emailComposer";
import { flagNeedsAttention, gateAiMessage, resolveApprovedMessage, settleMessageApproval } from "@/modules/governance/messageApproval";
import { runLinkedInAction } from "@/linkedin/puppeteerRunner";
import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";
import { emailService } from "@/modules/email-campaigner";

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gateAiMessage).mockResolvedValue({ send: true });
    vi.mocked(flagNeedsAttention).mockResolvedValue(undefined);
    vi.mocked(settleMessageApproval).mockResolvedValue(undefined);
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
        vi.mocked(composeNodeA).mockResolvedValueOnce({ subject: "Drafted subject", body: "Drafted body" } as any);
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

describe("handleSequenceAction approval gate", () => {
    const ownLead = {
        id: "lead-own",
        email: "own@example.com",
        campaignId: "campaign-1",
        fullName: "Own Lead",
        teamId: "team-1",
        enrichedData: null,
        campaign: { id: "campaign-1", teamId: "team-1", ownerId: "owner-1", team: {}, aiConfig: {} },
    };
    const linkedInLead = { enrichedData: null, teamId: "team-1", campaign: { teamId: "team-1", ownerId: "owner-1" } };
    const linkedInPayload = { leadId: "lead-1", url: "https://linkedin.com/in/x", teamId: "team-1" };

    it("holds an AI-written email for approval instead of sending it", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(ownLead as any);
        vi.mocked(composeNodeA).mockResolvedValueOnce({ subject: "Drafted subject", body: "Drafted body" } as any);
        vi.mocked(gateAiMessage).mockResolvedValueOnce({ send: false, held: "approval", approvalId: "appr-1" });

        const result = await handleSequenceAction({ leadId: "lead-own", action: "EMAIL", teamId: "team-1" });

        expect(result).toEqual({ ok: false, held: "approval" });
        expect(emailService.sendEmail).not.toHaveBeenCalled();
        expect(SequenceService.scheduleNextStep).not.toHaveBeenCalled();
        expect(gateAiMessage).toHaveBeenCalledWith(expect.objectContaining({ channel: "EMAIL", leadId: "lead-own", subject: "Drafted subject", body: "Drafted body" }));
    });

    it("retries generation twice, then flags needs-attention and sends no stand-in email", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(ownLead as any);
        vi.mocked(composeNodeA).mockRejectedValue(new Error("model down"));
        vi.spyOn(console, "warn").mockImplementation(() => {});

        const result = await handleSequenceAction({ leadId: "lead-own", action: "EMAIL", teamId: "team-1" });

        expect(composeNodeA).toHaveBeenCalledTimes(3);
        expect(result).toEqual({ ok: false, held: "needs_attention" });
        expect(flagNeedsAttention).toHaveBeenCalledWith(expect.objectContaining({ channel: "EMAIL", leadId: "lead-own", teamId: "team-1" }));
        expect(emailService.sendEmail).not.toHaveBeenCalled();
        vi.mocked(composeNodeA).mockReset();
    });

    it("sends an operator-chosen A/B variant without asking for approval", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(ownLead as any);
        vi.mocked(prisma.campaignVariant.findFirst).mockResolvedValueOnce({ id: "variant-1", campaignId: "campaign-1", subject: "S", body: "B" } as any);
        vi.mocked(emailService.sendEmail).mockResolvedValueOnce({ ok: true } as any);

        await handleSequenceAction({ leadId: "lead-own", action: "EMAIL", teamId: "team-1", variantId: "variant-1" });

        expect(gateAiMessage).not.toHaveBeenCalled();
        expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it("holds an AI connection note for approval instead of sending it", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(linkedInLead as any);
        vi.mocked(aiService.generateConnectionMessage).mockResolvedValueOnce("Hi there" as any);
        vi.mocked(gateAiMessage).mockResolvedValueOnce({ send: false, held: "approval", approvalId: "appr-2" });

        const result = await handleSequenceAction({ ...linkedInPayload, action: "CONNECT" });

        expect(result).toEqual({ ok: false, held: "approval" });
        expect(runLinkedInAction).not.toHaveBeenCalled();
        expect(gateAiMessage).toHaveBeenCalledWith(expect.objectContaining({ channel: "CONNECT", body: "Hi there" }));
    });

    it("sends no stand-in LinkedIn follow-up when the model returns nothing three times", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(linkedInLead as any);
        vi.mocked(aiService.askAI).mockResolvedValue("" as any);

        const result = await handleSequenceAction({ ...linkedInPayload, action: "MESSAGE" });

        expect(aiService.askAI).toHaveBeenCalledTimes(3);
        expect(result).toEqual({ ok: false, held: "needs_attention" });
        expect(runLinkedInAction).not.toHaveBeenCalled();
        vi.mocked(aiService.askAI).mockReset();
    });

    it("sends the approved LinkedIn message as approved, without writing a new one, and marks it sent", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(linkedInLead as any);
        vi.mocked(resolveApprovedMessage).mockResolvedValueOnce({ state: "ready", body: "The approved note" });

        await handleSequenceAction({ ...linkedInPayload, action: "CONNECT", approvedMessageId: "appr-2" } as any);

        expect(aiService.generateConnectionMessage).not.toHaveBeenCalled();
        expect(gateAiMessage).not.toHaveBeenCalled();
        expect(runLinkedInAction).toHaveBeenCalledWith({ action: "INMAIL", profileUrl: "https://linkedin.com/in/x", message: "The approved note" });
        expect(settleMessageApproval).toHaveBeenCalledWith("appr-2", "team-1", "SENT", undefined);
    });

    it("records a sent connection note with the prompt that wrote it, and holds it with the same provenance", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(linkedInLead as any);
        vi.mocked(aiService.generateConnectionMessage).mockResolvedValueOnce("Hi there" as any);
        vi.mocked(gateAiMessage).mockResolvedValueOnce({ send: true } as any);

        await handleSequenceAction({ ...linkedInPayload, action: "CONNECT" });

        const provenance = expect.objectContaining({ node: "linkedin", prompts: expect.objectContaining({ draft: "linkedin.connect@v1" }) });
        expect(gateAiMessage).toHaveBeenCalledWith(expect.objectContaining({ copyProvenance: provenance }));
        expect(prisma.message.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ leadId: "lead-1", content: "Hi there", direction: "OUTBOUND", platform: "LINKEDIN", status: "sent", copyProvenance: provenance }),
        });
    });

    it("records a sent follow-up, naming the follow-up prompt", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(linkedInLead as any);
        vi.mocked(aiService.askAI).mockResolvedValueOnce("Following up" as any);
        vi.mocked(gateAiMessage).mockResolvedValueOnce({ send: true } as any);

        await handleSequenceAction({ ...linkedInPayload, action: "MESSAGE" });

        expect(prisma.message.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ content: "Following up", copyProvenance: expect.objectContaining({ prompts: expect.objectContaining({ draft: "linkedin.followUp@v1" }) }) }),
        });
    });

    it("records an approved message with the provenance it was held with, and none when it had none", async () => {
        const copyProvenance = { v: 1, node: "linkedin" };
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(linkedInLead as any);
        vi.mocked(resolveApprovedMessage).mockResolvedValueOnce({ state: "ready", body: "Approved", copyProvenance } as any);
        await handleSequenceAction({ ...linkedInPayload, action: "CONNECT", approvedMessageId: "appr-9" } as any);
        expect(prisma.message.create).toHaveBeenCalledWith({ data: expect.objectContaining({ content: "Approved", copyProvenance }) });

        vi.mocked(prisma.message.create).mockClear();
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(linkedInLead as any);
        vi.mocked(resolveApprovedMessage).mockResolvedValueOnce({ state: "ready", body: "Older hold" } as any);
        await handleSequenceAction({ ...linkedInPayload, action: "CONNECT", approvedMessageId: "appr-10" } as any);
        expect(vi.mocked(prisma.message.create).mock.calls[0][0].data).not.toHaveProperty("copyProvenance");
    });

    it("still finishes the step when recording the message fails", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(linkedInLead as any);
        vi.mocked(resolveApprovedMessage).mockResolvedValueOnce({ state: "ready", body: "Approved" } as any);
        vi.mocked(prisma.message.create).mockRejectedValueOnce(new Error("db down"));
        const result = await handleSequenceAction({ ...linkedInPayload, action: "CONNECT", approvedMessageId: "appr-11" } as any);
        expect(result).toMatchObject({ ok: true });
        expect(SequenceService.scheduleNextStep).toHaveBeenCalled();
    });

    it("does not send when the approval was already handled or has expired", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(linkedInLead as any);
        vi.mocked(resolveApprovedMessage).mockResolvedValueOnce({ state: "expired" });

        const result = await handleSequenceAction({ ...linkedInPayload, action: "CONNECT", approvedMessageId: "appr-2" } as any);

        expect(result).toEqual({ ok: false, skipped: "expired" });
        expect(runLinkedInAction).not.toHaveBeenCalled();
    });

    it("sends the approved email once with an idempotency key tied to the approval, then continues the sequence", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(ownLead as any);
        vi.mocked(resolveApprovedMessage).mockResolvedValueOnce({ state: "ready", subject: "Approved subject", body: "Approved body" });
        vi.mocked(emailService.sendEmail).mockResolvedValueOnce({ ok: true } as any);

        await handleSequenceAction({ leadId: "lead-own", action: "EMAIL", teamId: "team-1", approvedMessageId: "appr-3" } as any);

        expect(composeNodeA).not.toHaveBeenCalled();
        expect(emailService.sendEmail).toHaveBeenCalledWith("own@example.com", "Approved subject", "Approved body", expect.objectContaining({ idempotencyKey: "approved_message_appr-3" }));
        expect(settleMessageApproval).toHaveBeenCalledWith("appr-3", "team-1", "SENT", undefined);
        expect(SequenceService.scheduleNextStep).toHaveBeenCalled();
    });

    it("carries the draft's provenance to the held approval, and from the approval to the sent email", async () => {
        const provenance = { v: 1, node: "A", marker: "prov-x" };
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(ownLead as any);
        vi.mocked(composeNodeA).mockResolvedValueOnce({ subject: "Drafted subject", body: "Drafted body", provenance } as any);
        vi.mocked(gateAiMessage).mockResolvedValueOnce({ send: false, held: "approval", approvalId: "appr-9" });
        await handleSequenceAction({ leadId: "lead-own", action: "EMAIL", teamId: "team-1" } as any);
        expect(gateAiMessage).toHaveBeenCalledWith(expect.objectContaining({ copyProvenance: provenance }));

        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(ownLead as any);
        vi.mocked(resolveApprovedMessage).mockResolvedValueOnce({ state: "ready", subject: "S", body: "B", copyProvenance: provenance } as any);
        vi.mocked(emailService.sendEmail).mockResolvedValueOnce({ ok: true } as any);
        await handleSequenceAction({ leadId: "lead-own", action: "EMAIL", teamId: "team-1", approvedMessageId: "appr-9" } as any);
        expect(emailService.sendEmail).toHaveBeenCalledWith("own@example.com", "S", "B", expect.objectContaining({ copyProvenance: provenance }));
    });

    it("sends a drafted email with no provenance when the draft carries none", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(ownLead as any);
        vi.mocked(composeNodeA).mockResolvedValueOnce({ subject: "Drafted subject", body: "Drafted body" } as any);
        vi.mocked(emailService.sendEmail).mockResolvedValueOnce({ ok: true } as any);
        await handleSequenceAction({ leadId: "lead-own", action: "EMAIL", teamId: "team-1" } as any);
        expect(vi.mocked(emailService.sendEmail).mock.calls.at(-1)![3]).not.toHaveProperty("copyProvenance");
    });

    it("flags the approval needs-attention when sending the approved message throws", async () => {
        vi.mocked(prisma.lead.findUnique).mockResolvedValueOnce(linkedInLead as any);
        vi.mocked(resolveApprovedMessage).mockResolvedValueOnce({ state: "ready", body: "The approved note" });
        vi.mocked(runLinkedInAction).mockRejectedValueOnce(new Error("browser crashed"));

        await expect(handleSequenceAction({ ...linkedInPayload, action: "CONNECT", approvedMessageId: "appr-2" } as any)).rejects.toThrow("browser crashed");

        expect(settleMessageApproval).toHaveBeenCalledWith("appr-2", "team-1", "NEEDS_ATTENTION", expect.any(String));
    });
});
