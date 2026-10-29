import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, enqueue } = vi.hoisted(() => ({
    prismaMock: {
        organizationPolicy: { findUnique: vi.fn() },
        approvalRequest: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
        user: { findFirst: vi.fn() },
    },
    enqueue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue } }));

import {
    MESSAGE_APPROVAL_TTL_MS,
    approveMessageSend,
    gateAiMessage,
    generateWithRetry,
    messageApprovalRequired,
    rejectMessageSend,
    resolveApprovedMessage,
} from "./messageApproval";

const gateInput = {
    teamId: "team-1",
    leadId: "lead-1",
    channel: "EMAIL" as const,
    jobType: "email_sending" as const,
    jobPayload: { leadId: "lead-1", campaignId: "campaign-1" },
    subject: "Subject",
    body: "Body",
    requesterHint: "owner-1",
};

beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("messageApprovalRequired", () => {
    it("is on for a team with no policy row", async () => {
        prismaMock.organizationPolicy.findUnique.mockResolvedValue(null);
        expect(await messageApprovalRequired("team-1")).toBe(true);
    });

    it("is on by default and off only when the team opted out", async () => {
        prismaMock.organizationPolicy.findUnique.mockResolvedValueOnce({ requiresMessageApproval: true });
        expect(await messageApprovalRequired("team-1")).toBe(true);
        prismaMock.organizationPolicy.findUnique.mockResolvedValueOnce({ requiresMessageApproval: false });
        expect(await messageApprovalRequired("team-1")).toBe(false);
    });
});

describe("generateWithRetry", () => {
    it("returns the first non-empty result", async () => {
        const generate = vi.fn().mockResolvedValue("text");
        expect(await generateWithRetry(generate)).toBe("text");
        expect(generate).toHaveBeenCalledTimes(1);
    });

    it("retries twice after a failure and succeeds on the third attempt", async () => {
        const generate = vi.fn().mockRejectedValueOnce(new Error("a")).mockResolvedValueOnce("").mockResolvedValueOnce("third");
        expect(await generateWithRetry(generate)).toBe("third");
        expect(generate).toHaveBeenCalledTimes(3);
    });

    it("gives up with null after three attempts", async () => {
        const generate = vi.fn().mockRejectedValue(new Error("down"));
        expect(await generateWithRetry(generate)).toBeNull();
        expect(generate).toHaveBeenCalledTimes(3);
    });
});

describe("gateAiMessage", () => {
    it("lets the message through when the team opted out", async () => {
        prismaMock.organizationPolicy.findUnique.mockResolvedValue({ requiresMessageApproval: false });
        expect(await gateAiMessage(gateInput)).toEqual({ send: true });
        expect(prismaMock.approvalRequest.create).not.toHaveBeenCalled();
    });

    it("holds the message as a pending approval that expires in 48 hours, keeping the text and the job to re-run", async () => {
        prismaMock.organizationPolicy.findUnique.mockResolvedValue(null);
        prismaMock.approvalRequest.findFirst.mockResolvedValue(null);
        prismaMock.approvalRequest.create.mockResolvedValue({ id: "appr-1" });
        const before = Date.now();

        const result = await gateAiMessage(gateInput);

        expect(result).toEqual({ send: false, held: "approval", approvalId: "appr-1" });
        const data = prismaMock.approvalRequest.create.mock.calls[0][0].data;
        expect(data).toMatchObject({ teamId: "team-1", requesterId: "owner-1", actionType: "MESSAGE_SEND", entityType: "Lead", entityId: "lead-1:EMAIL", status: "PENDING", tier: "QUEUED" });
        expect(data.autoDenyAt.getTime() - before).toBeGreaterThanOrEqual(MESSAGE_APPROVAL_TTL_MS);
        expect(data.autoDenyAt.getTime() - before).toBeLessThan(MESSAGE_APPROVAL_TTL_MS + 5000);
        expect(data.payload).toMatchObject({ jobType: "email_sending", jobPayload: gateInput.jobPayload, channel: "EMAIL", subject: "Subject", body: "Body" });
    });

    it("reuses the pending approval instead of filing a second one for the same lead and channel", async () => {
        prismaMock.organizationPolicy.findUnique.mockResolvedValue(null);
        prismaMock.approvalRequest.findFirst.mockResolvedValue({ id: "appr-existing" });

        const result = await gateAiMessage(gateInput);

        expect(result).toEqual({ send: false, held: "approval", approvalId: "appr-existing" });
        expect(prismaMock.approvalRequest.create).not.toHaveBeenCalled();
    });

    it("blocks the send and flags needs-attention when the lead has no team", async () => {
        const result = await gateAiMessage({ ...gateInput, teamId: undefined });
        expect(result).toEqual({ send: false, held: "needs_attention" });
        expect(prismaMock.approvalRequest.create).not.toHaveBeenCalled();
    });

    it("blocks the send when no team member can be named as the requester", async () => {
        prismaMock.organizationPolicy.findUnique.mockResolvedValue(null);
        prismaMock.approvalRequest.findFirst.mockResolvedValue(null);
        prismaMock.user.findFirst.mockResolvedValue(null);

        const result = await gateAiMessage({ ...gateInput, requesterHint: undefined });

        expect(result).toEqual({ send: false, held: "needs_attention" });
    });
});

describe("approveMessageSend", () => {
    const held = { jobType: "email_sending", jobPayload: { leadId: "lead-1", campaignId: "campaign-1" }, channel: "EMAIL", subject: "S", body: "B" };

    it("approves a pending request only while it has not expired, then re-runs the job with the approved text id", async () => {
        prismaMock.approvalRequest.updateMany.mockResolvedValue({ count: 1 });

        await approveMessageSend({ id: "appr-1", status: "PENDING", payload: held }, "team-1", "user-1");

        expect(prismaMock.approvalRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ id: "appr-1", teamId: "team-1", status: "PENDING", autoDenyAt: { gt: expect.any(Date) } }),
        }));
        expect(enqueue).toHaveBeenCalledWith("email_sending", { leadId: "lead-1", campaignId: "campaign-1", approvedMessageId: "appr-1" }, { teamId: "team-1", idempotencyKey: "approved_message_appr-1" });
    });

    it("refuses to approve a message late", async () => {
        prismaMock.approvalRequest.updateMany.mockResolvedValue({ count: 0 });

        await expect(approveMessageSend({ id: "appr-1", status: "PENDING", payload: held }, "team-1", "user-1")).rejects.toThrow(/expired/);
        expect(enqueue).not.toHaveBeenCalled();
    });

    it("is idempotent: approving an already approved request queues the same keyed job, not a new one", async () => {
        await approveMessageSend({ id: "appr-1", status: "APPROVED", payload: held }, "team-1", "user-1");

        expect(prismaMock.approvalRequest.updateMany).not.toHaveBeenCalled();
        expect(enqueue).toHaveBeenCalledWith("email_sending", expect.anything(), expect.objectContaining({ idempotencyKey: "approved_message_appr-1" }));
    });

    it("does nothing for a message that is already sending or sent", async () => {
        await approveMessageSend({ id: "appr-1", status: "SENT", payload: held }, "team-1", "user-1");
        await approveMessageSend({ id: "appr-1", status: "EXECUTING", payload: held }, "team-1", "user-1");

        expect(enqueue).not.toHaveBeenCalled();
    });

    it("will not approve a rejected or needs-attention request", async () => {
        await expect(approveMessageSend({ id: "appr-1", status: "REJECTED", payload: held }, "team-1", "user-1")).rejects.toThrow(/rejected/);
        await expect(approveMessageSend({ id: "appr-1", status: "NEEDS_ATTENTION", payload: held }, "team-1", "user-1")).rejects.toThrow(/needs attention/);
        expect(enqueue).not.toHaveBeenCalled();
    });
});

describe("rejectMessageSend", () => {
    it("only rejects a request that is still pending", async () => {
        await rejectMessageSend("appr-1", "team-1", "user-1", "off brand");

        expect(prismaMock.approvalRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "appr-1", teamId: "team-1", status: "PENDING" },
            data: expect.objectContaining({ status: "REJECTED", reviewNote: "off brand" }),
        }));
    });
});

describe("resolveApprovedMessage", () => {
    const heldPayload = { jobType: "email_sending", jobPayload: {}, channel: "EMAIL", subject: "S", body: "B" };

    it("claims an approved, unexpired message and returns its text", async () => {
        prismaMock.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
        prismaMock.approvalRequest.findFirst.mockResolvedValue({ id: "appr-1", status: "EXECUTING", autoDenyAt: new Date(Date.now() + 1000), payload: heldPayload });

        expect(await resolveApprovedMessage("appr-1", "team-1")).toEqual({ state: "ready", subject: "S", body: "B" });
        expect(prismaMock.approvalRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ status: "APPROVED", autoDenyAt: { gt: expect.any(Date) } }),
            data: { status: "EXECUTING" },
        }));
    });

    it("finds nothing to send when a duplicate run arrives after the first claimed it", async () => {
        prismaMock.approvalRequest.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.approvalRequest.findFirst.mockResolvedValue({ id: "appr-1", status: "EXECUTING", autoDenyAt: new Date(), payload: heldPayload });

        expect(await resolveApprovedMessage("appr-1", "team-1")).toEqual({ state: "already_handled" });
    });

    it("holds an approved message that ran past its 48 hours instead of sending it late", async () => {
        prismaMock.approvalRequest.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
        prismaMock.approvalRequest.findFirst.mockResolvedValue({ id: "appr-1", status: "APPROVED", autoDenyAt: new Date(Date.now() - 1000), payload: heldPayload });

        expect(await resolveApprovedMessage("appr-1", "team-1")).toEqual({ state: "expired" });
        expect(prismaMock.approvalRequest.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "NEEDS_ATTENTION" }) }));
    });

    it("sends nothing for a request that was never approved", async () => {
        prismaMock.approvalRequest.updateMany.mockResolvedValue({ count: 0 });
        prismaMock.approvalRequest.findFirst.mockResolvedValue({ id: "appr-1", status: "PENDING", autoDenyAt: new Date(Date.now() + 1000), payload: heldPayload });

        expect(await resolveApprovedMessage("appr-1", "team-1")).toEqual({ state: "not_approved" });
    });
});
