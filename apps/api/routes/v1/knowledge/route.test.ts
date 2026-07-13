import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuthorizeApiKey, mockKnowledgeIngressService, mockPrisma } = vi.hoisted(() => ({
    mockAuthorizeApiKey: vi.fn(),
    mockKnowledgeIngressService: {
        ingressCampaignKnowledge: vi.fn(),
        agenticSearch: vi.fn(),
    },
    mockPrisma: {
        campaign: {
            findFirst: vi.fn(),
        },
    },
}));

vi.mock("@/lib/apiAuth", () => ({
    authorizeApiKey: mockAuthorizeApiKey,
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/modules/rag/service/KnowledgeIngressService", () => ({
    KnowledgeIngressService: mockKnowledgeIngressService,
}));

function apiKeyAuth(teamId = "team-a") {
    return {
        ok: true,
        context: {
            keyId: "key-a",
            teamId,
            scopes: ["leads:read", "leads:write"],
        },
    };
}

async function json(response: Response) {
    return {
        status: response.status,
        body: await response.json(),
    };
}

describe("/v1/knowledge tenant isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthorizeApiKey.mockResolvedValue(apiKeyAuth());
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-a" });
        mockKnowledgeIngressService.agenticSearch.mockResolvedValue("Team A knowledge");
    });

    it("lets Team A write Team A campaign knowledge", async () => {
        const { POST } = await import("./route");

        const response = await POST(new Request("http://localhost/api/v1/knowledge", {
            method: "POST",
            body: JSON.stringify({
                campaignId: "campaign-a",
                source: "source text",
                type: "TEXT",
                content: "source text",
            }),
        }) as any);

        expect(response.status).toBe(200);
        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: "campaign-a", teamId: "team-a" },
            select: { id: true },
        });
        expect(mockKnowledgeIngressService.ingressCampaignKnowledge).toHaveBeenCalledWith(
            "campaign-a",
            "source text",
            "TEXT",
            "team-a"
        );
    });

    it("lets Team A read Team A campaign knowledge", async () => {
        const { GET } = await import("./route");

        const response = await GET(new Request("http://localhost/api/v1/knowledge?campaignId=campaign-a&q=pricing") as any);
        const payload = await json(response);

        expect(payload).toEqual({ status: 200, body: { results: "Team A knowledge" } });
        expect(mockKnowledgeIngressService.agenticSearch).toHaveBeenCalledWith("campaign-a", "pricing", "team-a");
    });

    it("blocks Team A from writing Team B campaign knowledge", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);
        const { POST } = await import("./route");

        const response = await POST(new Request("http://localhost/api/v1/knowledge", {
            method: "POST",
            body: JSON.stringify({
                campaignId: "campaign-b",
                source: "source text",
                type: "TEXT",
            }),
        }) as any);
        const payload = await json(response);

        expect(payload).toEqual({ status: 404, body: { error: "Campaign not found" } });
        expect(mockKnowledgeIngressService.ingressCampaignKnowledge).not.toHaveBeenCalled();
    });

    it("blocks Team A from reading Team B campaign knowledge", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);
        const { GET } = await import("./route");

        const response = await GET(new Request("http://localhost/api/v1/knowledge?campaignId=campaign-b&q=pricing") as any);
        const payload = await json(response);

        expect(payload).toEqual({ status: 404, body: { error: "Campaign not found" } });
        expect(mockKnowledgeIngressService.agenticSearch).not.toHaveBeenCalled();
    });

    it("makes nonexistent and foreign campaign IDs indistinguishable", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);
        const { GET, POST } = await import("./route");

        const foreignRead = await json(await GET(new Request("http://localhost/api/v1/knowledge?campaignId=team-b-campaign&q=pricing") as any));
        const nonexistentRead = await json(await GET(new Request("http://localhost/api/v1/knowledge?campaignId=missing-campaign&q=pricing") as any));
        const foreignWrite = await json(await POST(new Request("http://localhost/api/v1/knowledge", {
            method: "POST",
            body: JSON.stringify({ campaignId: "team-b-campaign", source: "x", type: "TEXT" }),
        }) as any));
        const nonexistentWrite = await json(await POST(new Request("http://localhost/api/v1/knowledge", {
            method: "POST",
            body: JSON.stringify({ campaignId: "missing-campaign", source: "x", type: "TEXT" }),
        }) as any));

        expect(foreignRead).toEqual(nonexistentRead);
        expect(foreignWrite).toEqual(nonexistentWrite);
        expect(foreignRead).toEqual({ status: 404, body: { error: "Campaign not found" } });
        expect(foreignWrite).toEqual({ status: 404, body: { error: "Campaign not found" } });
    });
});
