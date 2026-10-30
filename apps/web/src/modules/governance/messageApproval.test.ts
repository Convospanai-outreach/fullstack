import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockEnqueue } = vi.hoisted(() => ({
    mockPrisma: { approvalRequest: { updateMany: vi.fn() } },
    mockEnqueue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));

import { approveMessageSend, rejectMessageSend } from "./messageApproval";

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
