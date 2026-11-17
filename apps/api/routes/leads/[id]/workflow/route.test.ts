import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    ctx: vi.fn(),
    lead: vi.fn(),
    emailCount: vi.fn(),
    genCount: vi.fn(),
    channels: vi.fn(),
    approval: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentContext: m.ctx }));
vi.mock("@/lib/db", () => ({
    prisma: {
        lead: { findFirst: m.lead },
        email: { count: m.emailCount },
        generation: { count: m.genCount },
        leadChannelStatus: { findMany: m.channels },
        approvalRequest: { findFirst: m.approval },
    },
}));

import { GET } from "./route";

const call = () => GET(new Request("http://x"), { params: Promise.resolve({ id: "l1" }) });

beforeEach(() => {
    vi.resetAllMocks();
    m.ctx.mockResolvedValue({ userId: "u1", teamId: "t1" });
    m.lead.mockResolvedValue({
        isEnriched: true, lastScoredAt: null, dwellTimeMinutes: 0, emailClicks: 0, socialMentions: 0, icpFitScore: null,
        replyOutcome: null, pipelineState: "COLD", status: "NEW", wonAt: null,
    });
    m.emailCount.mockResolvedValue(0);
    m.genCount.mockResolvedValue(0);
    m.channels.mockResolvedValue([]);
    m.approval.mockResolvedValue(null);
});

describe("GET /leads/[id]/workflow", () => {
    it("rejects unauthenticated callers", async () => {
        m.ctx.mockResolvedValue({});
        expect((await call()).status).toBe(401);
    });

    it("404s for a lead outside the team", async () => {
        m.lead.mockResolvedValue(null);
        expect((await call()).status).toBe(404);
        expect(m.lead).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "l1", teamId: "t1" } }));
    });

    it("returns six steps", async () => {
        const { data } = await (await call()).json();
        expect(data.steps).toHaveLength(6);
        expect(data.steps[0].state).toBe("done");
        expect(data.steps[1].state).toBe("active");
    });
});
