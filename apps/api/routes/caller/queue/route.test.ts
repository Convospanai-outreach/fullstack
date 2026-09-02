import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContextFromRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        user: { findUnique: vi.fn() },
    },
}));

vi.mock("@/modules/caller/CallerService", () => ({
    CallerService: {
        getQueue: vi.fn(),
        claimLead: vi.fn(),
        completeTask: vi.fn(),
    },
}));

import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CallerService } from "@/modules/caller/CallerService";

function getRequest() {
    return new NextRequest("http://localhost:3001/api/caller/queue");
}

function postRequest(body: unknown) {
    return new NextRequest("http://localhost:3001/api/caller/queue", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

describe("GET /api/caller/queue", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.user.findUnique as any).mockResolvedValue({ enterpriseRole: "CALLER" });
    });

    it("rejects when auth context has no teamId", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: null });

        const response = await GET(getRequest());

        expect(CallerService.getQueue).not.toHaveBeenCalled();
        expect(response.status).toBe(403);
    });

    it("scopes the queue fetch to the caller's own team", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (CallerService.getQueue as any).mockResolvedValue({ assigned: [], pool: [] });

        const response = await GET(getRequest());

        expect(CallerService.getQueue).toHaveBeenCalledWith("user-1", "team-a");
        expect(response.status).toBe(200);
    });
});

describe("POST /api/caller/queue", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.user.findUnique as any).mockResolvedValue({ enterpriseRole: "CALLER" });
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("passes teamId through on claim", async () => {
        (CallerService.claimLead as any).mockResolvedValue({ id: "queue-1" });

        const response = await POST(postRequest({ action: "claim", leadId: "lead-1" }));

        expect(CallerService.claimLead).toHaveBeenCalledWith("lead-1", "user-1", "team-a");
        expect(response.status).toBe(200);
    });

    it("returns 404 when claiming a lead outside the caller's team", async () => {
        (CallerService.claimLead as any).mockRejectedValue(new Error("LEAD_NOT_FOUND"));

        const response = await POST(postRequest({ action: "claim", leadId: "lead-from-team-b" }));

        expect(response.status).toBe(404);
    });

    it("passes teamId through on complete", async () => {
        (CallerService.completeTask as any).mockResolvedValue(undefined);

        const response = await POST(postRequest({ action: "complete", leadId: "lead-1", outcome: "CLOSED" }));

        expect(CallerService.completeTask).toHaveBeenCalledWith("lead-1", "user-1", "team-a", "CLOSED", undefined);
        expect(response.status).toBe(200);
    });

    it("returns 404 when completing a task for a lead outside the caller's team", async () => {
        (CallerService.completeTask as any).mockRejectedValue(new Error("LEAD_NOT_FOUND"));

        const response = await POST(postRequest({ action: "complete", leadId: "lead-from-team-b", outcome: "CLOSED" }));

        expect(response.status).toBe(404);
    });
});
