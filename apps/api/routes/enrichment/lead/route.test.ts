import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/queue", () => ({
    JobQueue: {
        enqueue: vi.fn().mockResolvedValue({ id: "job-1" }),
    },
}));

import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

function postRequest(body: unknown) {
    return new NextRequest("http://localhost:3001/api/enrichment/lead", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

describe("POST /api/enrichment/lead", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("rejects an unauthenticated caller", async () => {
        (getCurrentContext as any).mockResolvedValue({ userId: null, teamId: null });

        const response = await POST(postRequest({ leadId: "lead-1" }));

        expect(response.status).toBe(401);
        expect(JobQueue.enqueue).not.toHaveBeenCalled();
    });

    it("refuses to enrich a lead that doesn't belong to the caller's team", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue(null);

        const response = await POST(postRequest({ leadId: "lead-from-team-b" }));

        expect(prisma.lead.findFirst).toHaveBeenCalledWith({
            where: { id: "lead-from-team-b", teamId: "team-a" },
        });
        expect(response.status).toBe(404);
        expect(JobQueue.enqueue).not.toHaveBeenCalled();
    });

    it("enqueues enrichment for a lead in the caller's own team", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1", teamId: "team-a" });

        const response = await POST(postRequest({ leadId: "lead-1", campaignId: "campaign-1" }));

        expect(JobQueue.enqueue).toHaveBeenCalledWith("lead_enrichment", {
            leadId: "lead-1",
            teamId: "team-a",
            campaignId: "campaign-1",
        });
        expect(response.status).toBe(200);
    });
});
