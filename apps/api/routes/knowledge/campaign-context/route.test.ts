import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockVectorSearch } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        lead: { findFirst: vi.fn() },
    },
    mockVectorSearch: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/rag/service/vectorStore", () => ({
    vectorStore: { search: mockVectorSearch },
}));

import { POST } from "./route";

function postWith(body: unknown) {
    return new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

describe("POST /knowledge/campaign-context", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when unauthenticated", async () => {
        mockGetCurrentContext.mockResolvedValue({ teamId: null });

        const res = await POST(postWith({ campaignId: "c1", leadId: "l1" }) as any);

        expect(res.status).toBe(401);
        expect(mockVectorSearch).not.toHaveBeenCalled();
    });

    it("searches across all of the caller's own knowledge bases (teamId from session, not the lead)", async () => {
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-a" });
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", company: "Acme Corp", campaignId: "camp-1" });
        mockVectorSearch.mockResolvedValue([
            { id: "item-1", content: "Acme just raised a Series B", metadata: { companyName: "Acme Corp" }, similarity: 0.9 },
        ]);

        const res = await POST(postWith({ campaignId: "camp-1", leadId: "lead-1" }) as any);
        const data = await res.json();

        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-a" },
            select: { id: true, company: true, campaignId: true },
        });
        // Not scoped to a single hardcoded knowledge base - vectorStore.search
        // already searches every KB belonging to this teamId.
        expect(mockVectorSearch).toHaveBeenCalledWith("Acme Corp camp-1", "team-a", 3);
        expect(data.context).toContain("Acme just raised a Series B");
    });

    it("still scopes to the session's teamId even when the supplied leadId belongs to another team", async () => {
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-a" });
        // findFirst is scoped by {id, teamId} - a cross-tenant leadId simply won't match,
        // so lead is null here, but effectiveCampaignId still falls back to the body's own
        // campaignId - the search must still run scoped to team-a, never a team derived
        // from the (unmatched) lead.
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockVectorSearch.mockResolvedValue([]);

        await POST(postWith({ campaignId: "camp-1", leadId: "lead-from-team-b" }) as any);

        expect(mockVectorSearch).toHaveBeenCalledWith("camp-1", "team-a", 3);
    });

    it("returns empty context when neither company nor campaign context can be resolved", async () => {
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-a" });
        mockPrisma.lead.findFirst.mockResolvedValue(null);

        const res = await POST(postWith({}) as any);
        const data = await res.json();

        expect(data.context).toBe("");
        expect(mockVectorSearch).not.toHaveBeenCalled();
    });
});
