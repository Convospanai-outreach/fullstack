import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuthorizeApiKey, mockPrisma } = vi.hoisted(() => ({
    mockAuthorizeApiKey: vi.fn(),
    mockPrisma: {
        lead: { update: vi.fn() },
    },
}));

vi.mock("@/lib/apiAuth", () => ({ authorizeApiKey: mockAuthorizeApiKey }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/apiRateLimit", () => ({
    checkApiRateLimit: vi.fn().mockResolvedValue({ success: true }),
    rateLimitResponse: vi.fn(),
}));

import { PATCH } from "./route";

function apiKeyAuth(teamId = "team-a") {
    return { ok: true, context: { keyId: "key-a", teamId, scopes: ["leads:write"] } };
}

function jsonRequest(body: any) {
    return new Request("http://localhost/v1/leads/lead-1", { method: "PATCH", body: JSON.stringify(body) }) as any;
}

function params(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("PATCH /v1/leads/[id] - field allowlisting", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthorizeApiKey.mockResolvedValue(apiKeyAuth());
        mockPrisma.lead.update.mockResolvedValue({ id: "lead-1" });
    });

    it("strips system-managed and ownership fields from an update payload", async () => {
        await PATCH(jsonRequest({
            status: "CONTACTED",
            leadScore: 9999,
            intentScore: 1.0,
            isEnriched: true,
            pipelineState: "HOT",
            wonAt: "2026-01-01T00:00:00.000Z",
            consentObtained: true,
            campaignId: "campaign-victim",
            teamId: "team-victim",
            id: "some-other-id",
        }), params("lead-1"));

        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-a" },
            data: { status: "CONTACTED", consentObtained: true },
        });
    });

    it("passes through only known-safe fields", async () => {
        await PATCH(jsonRequest({ fullName: "New Name", value: 500 }), params("lead-1"));

        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-a" },
            data: { fullName: "New Name", value: 500 },
        });
    });
});
