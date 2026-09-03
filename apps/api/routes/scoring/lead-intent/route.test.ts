import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        user: { findUnique: vi.fn() },
        lead: { findUnique: vi.fn() },
    },
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/modules/scoring", () => ({
    leadScoringService: {
        updateWeights: vi.fn(),
        getConfig: vi.fn().mockReturnValue({ weights: { dwellTime: 0.4, emailClicks: 0.35, socialMentions: 0.25 } }),
    },
}));

import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { leadScoringService } from "@/modules/scoring";

function putRequest(body: unknown) {
    return new NextRequest("http://localhost:3001/api/scoring/lead-intent", {
        method: "PUT",
        body: JSON.stringify(body),
    });
}

describe("PUT /api/scoring/lead-intent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("rejects a non-admin user - this mutates process-wide scoring config for every team", async () => {
        (prisma.user.findUnique as any).mockResolvedValue({ enterpriseRole: "SALES_USER" });

        const response = await PUT(putRequest({ weights: { dwellTime: 0.5 } }));

        expect(response.status).toBe(403);
        expect(leadScoringService.updateWeights).not.toHaveBeenCalled();
    });

    it("rejects a weights object with an unknown key", async () => {
        (prisma.user.findUnique as any).mockResolvedValue({ enterpriseRole: "ORG_ADMIN" });

        const response = await PUT(putRequest({ weights: { dwellTime: 0.5, unknownKey: 999 } }));

        expect(response.status).toBe(400);
        expect(leadScoringService.updateWeights).not.toHaveBeenCalled();
    });

    it("rejects a non-finite or out-of-range weight value", async () => {
        (prisma.user.findUnique as any).mockResolvedValue({ enterpriseRole: "ORG_ADMIN" });

        const response = await PUT(putRequest({ weights: { dwellTime: Infinity } }));

        expect(response.status).toBe(400);
        expect(leadScoringService.updateWeights).not.toHaveBeenCalled();
    });

    it("allows an admin to update weights with valid values", async () => {
        (prisma.user.findUnique as any).mockResolvedValue({ enterpriseRole: "ORG_ADMIN" });

        const response = await PUT(putRequest({ weights: { dwellTime: 0.5 } }));

        expect(response.status).toBe(200);
        expect(leadScoringService.updateWeights).toHaveBeenCalledWith({ dwellTime: 0.5 });
    });
});
