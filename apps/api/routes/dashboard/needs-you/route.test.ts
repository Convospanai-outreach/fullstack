import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/modules/inbox/needsYouService", () => ({ collectNeedsYou: vi.fn().mockResolvedValue([]) }));

import { GET } from "./route";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { collectNeedsYou } from "@/modules/inbox/needsYouService";

describe("GET /dashboard/needs-you", () => {
    beforeEach(() => vi.clearAllMocks());

    it("401s without a team context", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: null });

        const response = await GET(new NextRequest("http://localhost:3001/dashboard/needs-you"));

        expect(response.status).toBe(401);
        expect(collectNeedsYou).not.toHaveBeenCalled();
    });

    it("scopes to the caller's current team only", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });

        const response = await GET(new NextRequest("http://localhost:3001/dashboard/needs-you"));

        expect(collectNeedsYou).toHaveBeenCalledWith(["team-a"]);
        expect(await response.json()).toEqual({ needsYou: [] });
    });
});
