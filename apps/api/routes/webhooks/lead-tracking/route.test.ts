import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: { findFirst: vi.fn(), updateMany: vi.fn() },
        email: { findUnique: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/modules/scoring", () => ({
    leadScoringService: {
        scoreAndPersist: vi.fn().mockResolvedValue({ score: 0.5 }),
    },
}));

import { POST } from "./route";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { leadScoringService } from "@/modules/scoring";

function trackingRequest(body: unknown) {
    return new NextRequest("http://localhost:3001/webhooks/lead-tracking", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

describe("POST /webhooks/lead-tracking", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("rejects an unauthenticated caller before touching any lead", async () => {
        (getCurrentContext as any).mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(trackingRequest({ type: "email_click", leadId: "f3b28620-5e44-4567-ade5-40211faf7bf4" }));

        expect(res.status).toBe(401);
        expect(prisma.lead.findFirst).not.toHaveBeenCalled();
    });

    it("does not let a caller record a click on another team's lead", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue(null); // not found for this teamId

        const res = await POST(trackingRequest({ type: "email_click", leadId: "f3b28620-5e44-4567-ade5-40211faf7bf4" }));

        expect(res.status).toBe(404);
        expect(prisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "f3b28620-5e44-4567-ade5-40211faf7bf4", teamId: "team-1" } });
        expect(prisma.lead.updateMany).not.toHaveBeenCalled();
        expect(leadScoringService.scoreAndPersist).not.toHaveBeenCalled();
    });

    it("records an email click and rescoring for the caller's own lead", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue({ id: "f3b28620-5e44-4567-ade5-40211faf7bf4", teamId: "team-1" });
        (prisma.lead.updateMany as any).mockResolvedValue({ count: 1 });

        const res = await POST(trackingRequest({ type: "email_click", leadId: "f3b28620-5e44-4567-ade5-40211faf7bf4" }));

        expect(res.status).toBe(200);
        expect(prisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "f3b28620-5e44-4567-ade5-40211faf7bf4", teamId: "team-1" },
            data: { emailClicks: { increment: 1 } },
        });
        expect(leadScoringService.scoreAndPersist).toHaveBeenCalledWith("f3b28620-5e44-4567-ade5-40211faf7bf4");
    });

    it("resolves dwell tracking by email only within the caller's own team, not across tenants", async () => {
        (prisma.lead.findFirst as any).mockResolvedValueOnce(null); // email lookup scoped to team-1 finds nothing

        const res = await POST(trackingRequest({ type: "dwell", email: "shared@example.com", sessionSeconds: 60 }));

        expect(res.status).toBe(404);
        expect(prisma.lead.findFirst).toHaveBeenCalledWith({ where: { email: "shared@example.com", teamId: "team-1" } });
    });

    it("does not let a caller inflate dwell time on another team's lead by id", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue(null); // scoped findFirst for the id+teamId finds nothing

        const res = await POST(trackingRequest({ type: "dwell", leadId: "2c2bc7ea-f70f-42d7-9281-ec086fdc8c4b", sessionSeconds: 60 }));

        expect(res.status).toBe(404);
        expect(prisma.lead.updateMany).not.toHaveBeenCalled();
    });
});
