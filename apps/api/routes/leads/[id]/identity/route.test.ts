import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContextFromRequest: vi.fn(),
}));

const mockLeadFindFirst = vi.fn();
const mockScrapingJobFindFirst = vi.fn();

vi.mock("@/lib/dbFactory", () => ({
    DbFactory: {
        getClient: vi.fn(() => ({
            lead: { findFirst: mockLeadFindFirst },
            scrapingJob: { findFirst: mockScrapingJobFindFirst },
        })),
    },
}));

vi.mock("@/lib/identity/IdentityService", () => ({
    IdentityService: {
        reidentify: vi.fn().mockResolvedValue("real@example.com"),
    },
}));

import { getCurrentContextFromRequest } from "@/lib/auth";

function makeRequest(id: string) {
    return new Request(`http://localhost:3001/api/leads/${id}/identity`);
}

describe("GET /api/leads/[id]/identity", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects when there is no authenticated team context", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: null, teamId: null });

        const response = await GET(makeRequest("lead-1"), { params: Promise.resolve({ id: "lead-1" }) });

        expect(response.status).toBe(401);
        expect(mockLeadFindFirst).not.toHaveBeenCalled();
    });

    it("scopes the Lead lookup by the caller's own teamId, not just id", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockLeadFindFirst.mockResolvedValue(null);
        mockScrapingJobFindFirst.mockResolvedValue(null);

        const response = await GET(makeRequest("lead-from-team-b"), { params: Promise.resolve({ id: "lead-from-team-b" }) });

        expect(mockLeadFindFirst).toHaveBeenCalledWith({
            where: { id: "lead-from-team-b", teamId: "team-a" },
            select: { id: true, regionId: true, email: true, phone: true },
        });
        expect(response.status).toBe(404);
    });

    it("scopes the ScrapingJob fallback lookup by the caller's own teamId too", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockLeadFindFirst.mockResolvedValue(null);
        mockScrapingJobFindFirst.mockResolvedValue(null);

        await GET(makeRequest("job-from-team-b"), { params: Promise.resolve({ id: "job-from-team-b" }) });

        expect(mockScrapingJobFindFirst).toHaveBeenCalledWith({
            where: { id: "job-from-team-b", teamId: "team-a" },
        });
    });

    it("reveals masked PII for a lead that does belong to the caller's team", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockLeadFindFirst.mockResolvedValue({ id: "lead-1", regionId: "GLOBAL", email: "[masked-token]", phone: null });

        const response = await GET(makeRequest("lead-1"), { params: Promise.resolve({ id: "lead-1" }) });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.email).toBe("real@example.com");
    });
});
