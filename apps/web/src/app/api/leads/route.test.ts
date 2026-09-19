import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        lead: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn() },
        campaign: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET, POST } from "./route";

function getRequest(query: string) {
    return new Request(`http://localhost/api/leads${query}`) as any;
}

const FOREIGN_CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OWN_CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";

function postRequest(body: unknown) {
    return new Request("http://localhost/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /api/leads - campaignId team scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });
        mockPrisma.lead.update.mockResolvedValue({ id: "lead-1" });
    });

    it("drops a campaignId that doesn't belong to the caller's team instead of linking the lead to it", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null); // belongs to another team

        await POST(postRequest({ email: "foo@example.com", campaignId: FOREIGN_CAMPAIGN_ID }));

        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: FOREIGN_CAMPAIGN_ID, teamId: "team-a" },
            select: { id: true },
        });
        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ campaignId: null }),
        });
    });

    it("links the lead to a campaignId that belongs to the caller's own team", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: OWN_CAMPAIGN_ID });

        await POST(postRequest({ email: "foo@example.com", campaignId: OWN_CAMPAIGN_ID }));

        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ campaignId: OWN_CAMPAIGN_ID }),
        });
    });

    it("rejects an unauthenticated caller before touching any lead data", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postRequest({ email: "foo@example.com", campaignId: OWN_CAMPAIGN_ID }));

        expect(res.status).toBe(401);
        expect(mockPrisma.lead.create).not.toHaveBeenCalled();
        expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
    });
});

describe("GET /api/leads - pipelineState/unassignedOnly/domain filters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.lead.findMany.mockResolvedValue([]);
        mockPrisma.lead.count.mockResolvedValue(0);
    });

    it("filters by pipelineState when given, so a campaign can be scoped to leads dropped at a specific funnel stage", async () => {
        await GET(getRequest("?pipelineState=WARM"));

        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ teamId: "team-a", pipelineState: "WARM" }) })
        );
    });

    it("excludes leads already attached to a campaign when unassignedOnly=true", async () => {
        await GET(getRequest("?unassignedOnly=true"));

        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ campaignId: null }) })
        );
    });

    it("scopes to a single account by normalized domain", async () => {
        await GET(getRequest("?domain=Acme.Example"));

        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ domain: "acme.example" }) })
        );
    });

    it("ignores a syntactically invalid domain instead of erroring", async () => {
        await GET(getRequest("?domain=not a domain"));

        const call = mockPrisma.lead.findMany.mock.calls[0]?.[0];
        expect(call.where.domain).toBeUndefined();
    });
});
