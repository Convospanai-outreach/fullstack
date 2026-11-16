import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ctx: vi.fn(), campaign: vi.fn(), leads: vi.fn(), load: vi.fn(), summarise: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: m.ctx }));
vi.mock("@/lib/db", () => ({ prisma: { campaign: { findFirst: m.campaign }, lead: { findMany: m.leads } } }));
vi.mock("@/lib/leadWorkflowBatch", () => ({ loadLeadWorkflows: m.load, summariseWorkflows: m.summarise }));

import { GET } from "./route";

const call = () => GET(new Request("http://x"), { params: Promise.resolve({ id: "c1" }) });

beforeEach(() => {
    vi.resetAllMocks();
    m.ctx.mockResolvedValue({ userId: "u1", teamId: "t1" });
    m.campaign.mockResolvedValue({ id: "c1" });
    m.leads.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    m.load.mockResolvedValue(new Map());
    m.summarise.mockReturnValue([]);
});

describe("GET /campaigns/[id]/workflow", () => {
    it("rejects unauthenticated callers", async () => {
        m.ctx.mockResolvedValue({});
        expect((await call()).status).toBe(401);
    });

    it("404s for a campaign outside the team without reading its leads", async () => {
        m.campaign.mockResolvedValue(null);
        expect((await call()).status).toBe(404);
        expect(m.campaign).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", teamId: "t1" } }));
        expect(m.leads).not.toHaveBeenCalled();
    });

    it("summarises the campaign's own leads", async () => {
        const { data } = await (await call()).json();
        expect(m.leads).toHaveBeenCalledWith(expect.objectContaining({ where: { campaignId: "c1", teamId: "t1" } }));
        expect(m.load).toHaveBeenCalledWith("t1", ["a", "b"]);
        expect(data).toMatchObject({ leadCount: 2, capped: false });
    });

    it("says so when the campaign has more leads than it counts", async () => {
        m.leads.mockResolvedValue(Array.from({ length: 2001 }, (_, i) => ({ id: `l${i}` })));
        const { data } = await (await call()).json();
        expect(data).toMatchObject({ leadCount: 2000, capped: true });
    });
});
