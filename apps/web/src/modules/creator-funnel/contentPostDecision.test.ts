import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    approvalRequest: { updateMany: vi.fn() },
    contentPost: { updateMany: vi.fn() },
    $transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { decideContentPost } from "./contentPostDecision";

describe("decideContentPost (web)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.$transaction.mockImplementation((fn: any) => fn(mockDb));
        mockDb.approvalRequest.updateMany.mockResolvedValue({ count: 1 });
        mockDb.contentPost.updateMany.mockResolvedValue({ count: 1 });
    });

    it("moves only a pending request and the post still attached to it", async () => {
        expect(await decideContentPost("team-1", "req-1", "user-1", "APPROVED")).toBe(true);
        expect(mockDb.approvalRequest.updateMany.mock.calls[0][0].where).toEqual({ id: "req-1", teamId: "team-1", status: "PENDING", actionType: "CONTENT_POST_PUBLISH" });
        expect(mockDb.contentPost.updateMany.mock.calls[0][0]).toEqual({
            where: { teamId: "team-1", status: "IN_REVIEW", approvalRequestId: "req-1", scheduledAt: { gt: expect.any(Date) } },
            data: { status: "APPROVED" },
        });
    });

    it("does nothing on a second click or a withdrawn request", async () => {
        mockDb.approvalRequest.updateMany.mockResolvedValue({ count: 0 });
        expect(await decideContentPost("team-1", "req-1", "user-1", "APPROVED")).toBe(false);
        expect(mockDb.contentPost.updateMany).not.toHaveBeenCalled();
    });

    it("returns a late approval to draft instead of publishing it late", async () => {
        mockDb.contentPost.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
        await decideContentPost("team-1", "req-1", "user-1", "APPROVED");
        expect(mockDb.contentPost.updateMany.mock.calls[1][0].data.reviewNote).toMatch(/time passed/);
    });

    it("keeps the reviewer's reason on a rejected post", async () => {
        await decideContentPost("team-1", "req-1", "user-1", "REJECTED", "Wrong link");
        expect(mockDb.contentPost.updateMany.mock.calls[0][0].data).toEqual({ status: "DRAFT", approvalRequestId: null, reviewNote: "Not approved: Wrong link" });
    });
});
