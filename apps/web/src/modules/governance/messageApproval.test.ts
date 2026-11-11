import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockEnqueue, mockScheduleNext } = vi.hoisted(() => ({
    mockPrisma: { approvalRequest: { updateMany: vi.fn() } },
    mockEnqueue: vi.fn(),
    mockScheduleNext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));
vi.mock("@/lib/sequenceService", () => ({ SequenceService: { scheduleNextStep: mockScheduleNext } }));

import { approveMessageSend, canRetryMessage, rejectMessageSend, resolveNeedsAttention } from "./messageApproval";

const payload = {
    jobType: "SEQUENCE_ACTION",
    jobPayload: { enrollmentId: "e1" },
    channel: "EMAIL",
    subject: "Hello",
    body: "Original body",
};
const pending = { id: "ap1", status: "PENDING", payload };

describe("approveMessageSend", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
    });

    it("claims a pending approval and queues the original job once, keyed by the approval id", async () => {
        await approveMessageSend(pending, "t1", "u1");

        expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ id: "ap1", teamId: "t1", status: "PENDING", autoDenyAt: { gt: expect.any(Date) } }),
                data: expect.objectContaining({ status: "APPROVED", reviewerId: "u1" }),
            }),
        );
        expect(mockEnqueue).toHaveBeenCalledWith(
            "SEQUENCE_ACTION",
            { enrollmentId: "e1", approvedMessageId: "ap1" },
            { teamId: "t1", idempotencyKey: "approved_message_ap1" },
        );
    });

    it("stores the reviewer's edited subject and body when approving", async () => {
        await approveMessageSend(pending, "t1", "u1", { subject: " New subject ", body: " Edited body " });

        const data = mockPrisma.approvalRequest.updateMany.mock.calls[0][0].data;
        expect(data.payload).toEqual(expect.objectContaining({ subject: "New subject", body: "Edited body", jobType: "SEQUENCE_ACTION" }));
    });

    it("keeps the original text when no edit is given", async () => {
        await approveMessageSend(pending, "t1", "u1", {});

        const data = mockPrisma.approvalRequest.updateMany.mock.calls[0][0].data;
        expect(data.payload).toEqual(expect.objectContaining({ subject: "Hello", body: "Original body" }));
    });

    it("rejects an edit that empties the body, without approving", async () => {
        await expect(approveMessageSend(pending, "t1", "u1", { body: "   " })).rejects.toThrow("cannot be empty");
        expect(mockPrisma.approvalRequest.updateMany).not.toHaveBeenCalled();
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("does not approve an expired or already decided request", async () => {
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 0 });

        await expect(approveMessageSend(pending, "t1", "u1")).rejects.toThrow("expired or was already decided");
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("does nothing when the message is already being sent or sent", async () => {
        await approveMessageSend({ ...pending, status: "SENT" }, "t1", "u1");
        await approveMessageSend({ ...pending, status: "EXECUTING" }, "t1", "u1");

        expect(mockPrisma.approvalRequest.updateMany).not.toHaveBeenCalled();
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("re-queues (idempotently) an already approved request without re-claiming it", async () => {
        await approveMessageSend({ ...pending, status: "APPROVED" }, "t1", "u1");

        expect(mockPrisma.approvalRequest.updateMany).not.toHaveBeenCalled();
        expect(mockEnqueue).toHaveBeenCalledTimes(1);
    });

    it("refuses a rejected request", async () => {
        await expect(approveMessageSend({ ...pending, status: "REJECTED" }, "t1", "u1")).rejects.toThrow("already rejected");
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("refuses a request with no stored message", async () => {
        await expect(approveMessageSend({ ...pending, payload: {} }, "t1", "u1")).rejects.toThrow("no message to send");
    });
});

describe("rejectMessageSend", () => {
    beforeEach(() => vi.clearAllMocks());

    it("only rejects a request that is still pending", async () => {
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });

        await expect(rejectMessageSend("ap1", "t1", "u1", "Off topic")).resolves.toBe(true);
        expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "ap1", teamId: "t1", status: "PENDING" },
                data: expect.objectContaining({ status: "REJECTED", reviewNote: "Off topic" }),
            }),
        );
    });

    it("reports false when it was no longer pending", async () => {
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 0 });
        await expect(rejectMessageSend("ap1", "t1", "u1")).resolves.toBe(false);
    });
});

describe("resolveNeedsAttention", () => {
    const failedJob = {
        channel: "EMAIL",
        leadId: "l1",
        jobType: "SEQUENCE_ACTION",
        jobPayload: { leadId: "l1", url: "https://linkedin.com/in/x", action: "CONNECT", variantId: "v1" },
    };
    const row = { id: "na1", status: "NEEDS_ATTENTION", payload: failedJob };

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
    });

    it("only a failed draft that kept its job can be retried or written", () => {
        expect(canRetryMessage(failedJob)).toBe(true);
        expect(canRetryMessage({ channel: "EMAIL", leadId: "l1" })).toBe(false);
        expect(canRetryMessage({ ...failedJob, body: "already written" })).toBe(false);
    });

    it("retry claims the row, then queues the original job once under its own key", async () => {
        await resolveNeedsAttention(row, "t1", "u1", "RETRY");

        expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "na1", teamId: "t1", status: "NEEDS_ATTENTION" },
                data: expect.objectContaining({ status: "RETRIED", reviewerId: "u1" }),
            }),
        );
        expect(mockEnqueue).toHaveBeenCalledTimes(1);
        expect(mockEnqueue).toHaveBeenCalledWith("SEQUENCE_ACTION", failedJob.jobPayload, { teamId: "t1", idempotencyKey: "retry_message_na1" });
    });

    it("a second click finds the row already claimed and queues nothing", async () => {
        mockPrisma.approvalRequest.updateMany.mockResolvedValue({ count: 0 });

        await expect(resolveNeedsAttention(row, "t1", "u1", "RETRY")).rejects.toThrow(/already handled/);
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("write manually approves the reviewer's text and queues the job as an approved message", async () => {
        await resolveNeedsAttention(row, "t1", "u1", "WRITE", { subject: " Hi there ", body: " My own words " });

        expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: "APPROVED",
                    payload: expect.objectContaining({ subject: "Hi there", body: "My own words", jobType: "SEQUENCE_ACTION" }),
                }),
            }),
        );
        expect(mockEnqueue).toHaveBeenCalledWith(
            "SEQUENCE_ACTION",
            { ...failedJob.jobPayload, approvedMessageId: "na1" },
            { teamId: "t1", idempotencyKey: "approved_message_na1" },
        );
    });

    it("write manually refuses an empty body, and an email with no subject, before touching the row", async () => {
        await expect(resolveNeedsAttention(row, "t1", "u1", "WRITE", { body: "  " })).rejects.toThrow(/Write the message/);
        await expect(resolveNeedsAttention(row, "t1", "u1", "WRITE", { body: "text" })).rejects.toThrow(/subject/);
        expect(mockPrisma.approvalRequest.updateMany).not.toHaveBeenCalled();
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("skip closes the row and moves a sequence on to its next step", async () => {
        await resolveNeedsAttention(row, "t1", "u1", "SKIP");

        expect(mockPrisma.approvalRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: "SKIPPED" }) }),
        );
        expect(mockScheduleNext).toHaveBeenCalledWith("l1", "https://linkedin.com/in/x", "CONNECT", "t1", "v1");
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("skip on a failed send (no saved job) just closes the row", async () => {
        await resolveNeedsAttention({ id: "na2", status: "NEEDS_ATTENTION", payload: { ...failedJob, body: "sent text" } }, "t1", "u1", "SKIP");

        expect(mockScheduleNext).not.toHaveBeenCalled();
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("retry and write are refused on a failed send, where re-running could send twice", async () => {
        const failedSend = { id: "na2", status: "NEEDS_ATTENTION", payload: { ...failedJob, body: "sent text" } };

        await expect(resolveNeedsAttention(failedSend, "t1", "u1", "RETRY")).rejects.toThrow(/Skip it/);
        await expect(resolveNeedsAttention(failedSend, "t1", "u1", "WRITE", { subject: "s", body: "b" })).rejects.toThrow(/Skip it/);
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("puts the row back when queueing fails, so it can be tried again", async () => {
        mockEnqueue.mockRejectedValueOnce(new Error("queue down"));

        await expect(resolveNeedsAttention(row, "t1", "u1", "RETRY")).rejects.toThrow("queue down");

        expect(mockPrisma.approvalRequest.updateMany).toHaveBeenLastCalledWith(
            expect.objectContaining({
                where: { id: "na1", teamId: "t1", status: "RETRIED" },
                data: expect.objectContaining({ status: "NEEDS_ATTENTION" }),
            }),
        );
    });

    it("refuses a row that is no longer waiting", async () => {
        await expect(resolveNeedsAttention({ ...row, status: "SKIPPED" }, "t1", "u1", "SKIP")).rejects.toThrow(/no longer needs attention/);
    });
});
