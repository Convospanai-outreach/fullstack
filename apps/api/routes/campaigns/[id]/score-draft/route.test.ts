import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockJudge, mockContext } = vi.hoisted(() => ({
    mockPrisma: { campaign: { findFirst: vi.fn() } },
    mockJudge: vi.fn(),
    mockContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockContext }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: vi.fn().mockResolvedValue(undefined), TeamRole: { MEMBER: "member" } }));
vi.mock("@/lib/ai/jev", () => ({
    judgeDraftFactors: mockJudge,
    JevUnavailableError: class JevUnavailableError extends Error {},
}));

import { JevUnavailableError } from "@/lib/ai/jev";
import { POST } from "./route";

const FACTORS = {
    motivation: 1, valueClarity: 1, incentive: 1, friction: 0, anxiety: 0, relevance: 1,
    urgency: 1, distraction: 0, dreamOutcome: 1, likelihood: 1, timeDelay: 0,
};
const ctx = { params: Promise.resolve({ id: "camp-1" }) };
const post = (body: unknown) => new Request("http://localhost/api/campaigns/camp-1/score-draft", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/campaigns/[id]/score-draft", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["JEV_DRAFT_SCORES"] = "on";
        mockContext.mockResolvedValue({ userId: "u1", teamId: "team-1" });
        mockPrisma.campaign.findFirst.mockResolvedValue({ aiConfig: { strategies: ["S7", "S12", "S3"] } });
        mockJudge.mockResolvedValue(FACTORS);
    });

    it("is off unless JEV_DRAFT_SCORES is on, and never calls Jev", async () => {
        delete process.env["JEV_DRAFT_SCORES"];
        const res = await POST(post({ body: "Hi" }), ctx);
        expect(res.status).toBe(503);
        expect(mockJudge).not.toHaveBeenCalled();
    });

    it("scores the strategies the campaign follows, not ones the request names", async () => {
        const res = await POST(post({ body: "Hi there", strategies: ["S8"] }), ctx);
        const json = await res.json();
        expect(res.status).toBe(200);
        expect(json.scores.map((s: { strategyId: string }) => s.strategyId)).toEqual(["S7", "S12"]);
        expect(mockJudge).toHaveBeenCalledWith({ body: "Hi there" }, "team-1");
    });

    it("refuses a campaign with no scoring strategy, before calling Jev", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue({ aiConfig: { strategies: ["S3"] } });
        expect((await POST(post({ body: "Hi" }), ctx)).status).toBe(400);
        expect(mockJudge).not.toHaveBeenCalled();
    });

    it("looks the campaign up within the caller's team, and refuses a missing one", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);
        expect((await POST(post({ body: "Hi" }), ctx)).status).toBe(404);
        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "camp-1", teamId: "team-1" } }));
    });

    it("rejects an empty or oversized draft", async () => {
        expect((await POST(post({ body: "" }), ctx)).status).toBe(400);
        expect((await POST(post({ body: "x".repeat(6001) }), ctx)).status).toBe(400);
    });

    it("says so when Jev is unavailable or fails, without a score", async () => {
        mockJudge.mockRejectedValueOnce(new JevUnavailableError());
        expect((await POST(post({ body: "Hi" }), ctx)).status).toBe(503);
        mockJudge.mockRejectedValueOnce(new Error("timeout"));
        expect((await POST(post({ body: "Hi" }), ctx)).status).toBe(502);
    });

    it("requires a signed-in team member", async () => {
        mockContext.mockResolvedValue({ userId: null, teamId: null });
        expect((await POST(post({ body: "Hi" }), ctx)).status).toBe(401);
    });
});
