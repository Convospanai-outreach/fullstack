import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/modules/inbox/actionInboxService", () => ({
    REPLY_OUTCOMES: ["interested", "not_interested", "meeting_booked", "wrong_person"],
    markReplyOutcome: vi.fn().mockResolvedValue({ leadId: "lead-1", outcome: "interested", stoppedEnrollments: 1 }),
}));

import { POST } from "./route";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { markReplyOutcome } from "@/modules/inbox/actionInboxService";

const post = (body: unknown) =>
    POST(new NextRequest("http://localhost:3001/inbox/replies/msg-1/mark", { method: "POST", body: JSON.stringify(body) }), {
        params: Promise.resolve({ id: "msg-1" }),
    });

describe("POST /inbox/replies/:id/mark", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("rejects an unknown outcome", async () => {
        const response = await post({ outcome: "maybe" });

        expect(response.status).toBe(400);
        expect(markReplyOutcome).not.toHaveBeenCalled();
    });

    it("marks the outcome within the caller's team", async () => {
        const response = await post({ outcome: "interested" });

        expect(response.status).toBe(200);
        expect(markReplyOutcome).toHaveBeenCalledWith("team-a", "msg-1", "interested");
    });
});
