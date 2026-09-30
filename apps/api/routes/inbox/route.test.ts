import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/modules/inbox/actionInboxService", () => ({ getInbox: vi.fn().mockResolvedValue({ replies: { items: [] } }) }));

import { GET } from "./route";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { getInbox } from "@/modules/inbox/actionInboxService";

describe("GET /inbox", () => {
    beforeEach(() => vi.clearAllMocks());

    it("401s without a team context", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: null });

        const response = await GET(new NextRequest("http://localhost:3001/inbox"));

        expect(response.status).toBe(401);
        expect(getInbox).not.toHaveBeenCalled();
    });

    it("passes the caller's team and clamps pagination", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });

        await GET(new NextRequest("http://localhost:3001/inbox?page=-4&limit=500"));

        expect(getInbox).toHaveBeenCalledWith("team-a", { page: 1, limit: 50 });
    });
});
