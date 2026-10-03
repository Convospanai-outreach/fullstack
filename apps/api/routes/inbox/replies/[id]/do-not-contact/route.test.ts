import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/modules/inbox/actionInboxService", () => ({
    markReplyDoNotContact: vi.fn().mockResolvedValue({ leadId: "lead-1", outcome: "not_interested", stoppedEnrollments: 1, suppressed: true }),
}));

import { POST } from "./route";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { markReplyDoNotContact } from "@/modules/inbox/actionInboxService";

const post = () =>
    POST(new NextRequest("http://localhost:3001/inbox/replies/msg-1/do-not-contact", { method: "POST" }), {
        params: Promise.resolve({ id: "msg-1" }),
    });

describe("POST /inbox/replies/:id/do-not-contact", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("rejects an unauthenticated caller", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: null, teamId: null });

        const response = await post();

        expect(response.status).toBe(401);
        expect(markReplyDoNotContact).not.toHaveBeenCalled();
    });

    it("suppresses within the caller's team, recording who did it", async () => {
        const response = await post();

        expect(response.status).toBe(200);
        expect(markReplyDoNotContact).toHaveBeenCalledWith("team-a", "msg-1", "user-1");
        expect(await response.json()).toMatchObject({ suppressed: true });
    });
});
