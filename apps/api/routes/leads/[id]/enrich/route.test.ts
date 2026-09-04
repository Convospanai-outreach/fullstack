import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(),
}));

vi.mock("@/modules/enrichment/service/EnrichmentService", () => ({
    EnrichmentService: { enrichLead: vi.fn() },
}));

import { getCurrentContext } from "@/lib/auth";
import { EnrichmentService } from "@/modules/enrichment/service/EnrichmentService";

function postRequest() {
    return new Request("http://localhost:3001/api/leads/lead-1/enrich", { method: "POST" });
}

describe("POST /api/leads/[id]/enrich", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ teamId: "team-a" });
    });

    it("rejects an unauthenticated caller", async () => {
        (getCurrentContext as any).mockResolvedValue({ teamId: null });

        const response = await POST(postRequest(), { params: Promise.resolve({ id: "lead-1" }) });

        expect(response.status).toBe(401);
        expect(EnrichmentService.enrichLead).not.toHaveBeenCalled();
    });

    it("returns 404 when the lead doesn't belong to the caller's team", async () => {
        (EnrichmentService.enrichLead as any).mockResolvedValue(null);

        const response = await POST(postRequest(), { params: Promise.resolve({ id: "lead-from-team-b" }) });

        expect(EnrichmentService.enrichLead).toHaveBeenCalledWith("lead-from-team-b", "team-a");
        expect(response.status).toBe(404);
    });

    it("enriches a lead belonging to the caller's team", async () => {
        (EnrichmentService.enrichLead as any).mockResolvedValue({ success: true, jobId: "job-1" });

        const response = await POST(postRequest(), { params: Promise.resolve({ id: "lead-1" }) });

        expect(response.status).toBe(200);
    });
});
