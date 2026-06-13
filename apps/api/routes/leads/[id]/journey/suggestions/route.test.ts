import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAnalyzeLeadJourney, mockAuthorizeRole, mockGetCurrentContext } = vi.hoisted(() => ({
    mockAnalyzeLeadJourney: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockGetCurrentContext: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    getCurrentContext: mockGetCurrentContext,
}));

vi.mock("@/lib/permissions", () => ({
    TeamRole: { MEMBER: "MEMBER" },
    authorizeRole: mockAuthorizeRole,
}));

vi.mock("@/services/leadJourneySuggestionService", () => ({
    analyzeLeadJourney: mockAnalyzeLeadJourney,
}));

function params(id = "lead-1") {
    return { params: Promise.resolve({ id }) };
}

describe("lead journey suggestions route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockAnalyzeLeadJourney.mockResolvedValue({
            generatedAt: "2026-06-13T00:00:00.000Z",
            suggestions: [{
                id: "lead_stale_15_days",
                severity: "high",
                title: "Lead has not moved for 15+ days",
                reason: "No activity was detected.",
                recommendation: "Review follow-up.",
                suggestedAction: { channel: "CALL", status: "FOLLOW_UP" },
            }],
        });
    });

    it("returns advisory-only suggestions for the workspace lead", async () => {
        const { GET } = await import("./route");

        const response = await GET(new Request("http://localhost/api/leads/lead-1/journey/suggestions"), params());
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.mode).toBe("advisory_only");
        expect(payload.message).toContain("No lead status was changed");
        expect(payload.suggestions).toHaveLength(1);
        expect(mockAnalyzeLeadJourney).toHaveBeenCalledWith({ teamId: "team-1", leadId: "lead-1" });
    });

    it("requires authenticated team context", async () => {
        mockGetCurrentContext.mockResolvedValueOnce({ teamId: null, userId: null });
        const { GET } = await import("./route");

        const response = await GET(new Request("http://localhost/api/leads/lead-1/journey/suggestions"), params());
        const payload = await response.json();

        expect(response.status).toBe(401);
        expect(payload.code).toBe("UNAUTHORIZED");
        expect(mockAnalyzeLeadJourney).not.toHaveBeenCalled();
    });

    it("returns not found when analyzer cannot find the lead", async () => {
        mockAnalyzeLeadJourney.mockRejectedValueOnce(Object.assign(new Error("Lead not found"), { statusCode: 404 }));
        const { GET } = await import("./route");

        const response = await GET(new Request("http://localhost/api/leads/missing/journey/suggestions"), params("missing"));
        const payload = await response.json();

        expect(response.status).toBe(404);
        expect(payload.code).toBe("NOT_FOUND");
    });
});
