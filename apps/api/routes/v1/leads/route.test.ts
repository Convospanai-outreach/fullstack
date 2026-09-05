import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuthorizeApiKey, mockPrisma } = vi.hoisted(() => ({
    mockAuthorizeApiKey: vi.fn(),
    mockPrisma: {
        lead: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
        campaign: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/apiAuth", () => ({ authorizeApiKey: mockAuthorizeApiKey }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/apiRateLimit", () => ({
    checkApiRateLimit: vi.fn().mockResolvedValue({ success: true }),
    rateLimitResponse: vi.fn(),
}));

import { POST } from "./route";

function apiKeyAuth(teamId = "team-a") {
    return { ok: true, context: { keyId: "key-a", teamId, scopes: ["leads:write"] } };
}

function jsonRequest(body: any) {
    return new Request("http://localhost/v1/leads", { method: "POST", body: JSON.stringify(body) }) as any;
}

describe("POST /v1/leads - field allowlisting and campaignId scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthorizeApiKey.mockResolvedValue(apiKeyAuth());
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });
    });

    it("strips system-managed fields from a create payload", async () => {
        await POST(jsonRequest({
            email: "a@b.com",
            leadScore: 9999,
            intentScore: 1.0,
            isEnriched: true,
            pipelineState: "HOT",
            teamId: "team-victim",
        }));

        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: { email: "a@b.com", teamId: "team-a", status: "NEW" },
        });
    });

    it("rejects a campaignId belonging to a different team", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);

        const res = await POST(jsonRequest({ email: "a@b.com", campaignId: "campaign-victim" }));

        expect(res.status).toBe(400);
        expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    });

    it("allows a campaignId that belongs to the caller's own team", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-own" });

        const res = await POST(jsonRequest({ email: "a@b.com", campaignId: "campaign-own" }));

        expect(res.status).toBe(201);
        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: { email: "a@b.com", campaignId: "campaign-own", teamId: "team-a", status: "NEW" },
        });
    });
});
