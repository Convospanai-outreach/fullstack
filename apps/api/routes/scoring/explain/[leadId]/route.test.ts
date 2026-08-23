import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Mock the auth context
vi.mock("@/lib/auth", () => ({
    getCurrentContextFromRequest: vi.fn().mockResolvedValue({
        userId: "user-123",
        teamId: "team-A"
    })
}));

// Mock prisma lead findUnique
const mockFindUnique = vi.fn();
vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findUnique: (...args: any[]) => mockFindUnique(...args)
        }
    }
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn()
    }
}));

// Mock scoring service so we don't need real algorithms to run
vi.mock("@/modules/scoring", () => ({
    leadScoringService: {
        generateExplanation: vi.fn().mockReturnValue({ score: 100, reasons: [] })
    },
    caseStudyService: {
        retrieveRelevantCaseStudies: vi.fn().mockResolvedValue([])
    }
}));

function createRequest() {
    return new NextRequest("http://localhost:3001/api/scoring/explain/lead-123");
}

describe("GET /api/scoring/explain/[leadId]", () => {
    it("fetches lead using both leadId and teamId to prevent IDOR", async () => {
        const req = createRequest();
        
        // Mock returning null (lead not found / not in team)
        mockFindUnique.mockResolvedValueOnce(null);
        
        const response = await GET(req, { params: Promise.resolve({ leadId: "lead-123" }) });
        
        // Assert that we called Prisma with both id and teamId
        expect(mockFindUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                id: "lead-123",
                teamId: "team-A"
            }
        }));
        
        // Assert it returns 404 since the lead doesn't exist or isn't in their team
        expect(response.status).toBe(404);
    });
});
