import { describe, expect, it, vi, beforeEach } from "vitest";
import { PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
    authorizeRole: vi.fn().mockResolvedValue(undefined),
    TeamRole: { VIEWER: "VIEWER", MEMBER: "MEMBER", ADMIN: "ADMIN" },
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        campaign: { findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    },
}));

vi.mock("@/lib/campaignService", () => ({
    CampaignService: {
        addLeadsToCampaign: vi.fn().mockResolvedValue(undefined),
        startCampaign: vi.fn(),
        pauseCampaign: vi.fn(),
        getCampaignStats: vi.fn(),
    },
}));

import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CampaignService } from "@/lib/campaignService";

function patchRequest(body: unknown) {
    return new Request("http://localhost:3001/api/campaigns/campaign-1", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

describe("PATCH /api/campaigns/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (prisma.campaign.findFirst as any).mockResolvedValue({ id: "campaign-1", teamId: "team-a", leadList: [] });
    });

    it("passes the caller's own teamId through to addLeadsToCampaign", async () => {
        const response = await PATCH(
            patchRequest({ leadIds: ["lead-1", "lead-from-team-b"] }),
            { params: Promise.resolve({ id: "campaign-1" }) }
        );

        expect(CampaignService.addLeadsToCampaign).toHaveBeenCalledWith(
            "campaign-1",
            ["lead-1", "lead-from-team-b"],
            "team-a"
        );
        expect(response.status).toBe(200);
    });

    it("returns 404 for a campaign that doesn't belong to the caller's team", async () => {
        (prisma.campaign.findFirst as any).mockResolvedValue(null);

        const response = await PATCH(
            patchRequest({ leadIds: ["lead-1"] }),
            { params: Promise.resolve({ id: "campaign-from-team-b" }) }
        );

        expect(CampaignService.addLeadsToCampaign).not.toHaveBeenCalled();
        expect(response.status).toBe(404);
    });

    // roadmap 3.3 (S-10): any `status` string used to be written straight into
    // Campaign.status.
    it("rejects an arbitrary status with a 400 and field errors, without writing", async () => {
        const response = await PATCH(patchRequest({ status: "hacked" }), { params: Promise.resolve({ id: "campaign-1" }) });

        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json.code).toBe("VALIDATION_ERROR");
        expect(json.details.fieldErrors.status).toBeDefined();
        expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it("still writes a real status and name", async () => {
        const response = await PATCH(
            patchRequest({ status: "completed", name: "Q4" }),
            { params: Promise.resolve({ id: "campaign-1" }) }
        );

        expect(response.status).toBe(200);
        expect(prisma.campaign.update).toHaveBeenCalledWith({
            where: { id: "campaign-1" },
            data: { name: "Q4", status: "completed" },
        });
    });

    it("writes draftGenerationMode only while the campaign is a draft, and only REALTIME or BATCH", async () => {
        (prisma.campaign.findFirst as any).mockResolvedValue({ id: "campaign-1", teamId: "team-a", status: "draft", leadList: [] });
        const ok = await PATCH(patchRequest({ draftGenerationMode: "BATCH" }), { params: Promise.resolve({ id: "campaign-1" }) });
        expect(ok.status).toBe(200);
        expect(prisma.campaign.update).toHaveBeenCalledWith({ where: { id: "campaign-1" }, data: { draftGenerationMode: "BATCH" } });

        (prisma.campaign.update as any).mockClear();
        const bad = await PATCH(patchRequest({ draftGenerationMode: "TURBO" }), { params: Promise.resolve({ id: "campaign-1" }) });
        expect(bad.status).toBe(400);

        (prisma.campaign.findFirst as any).mockResolvedValue({ id: "campaign-1", teamId: "team-a", status: "active", leadList: [] });
        const late = await PATCH(patchRequest({ draftGenerationMode: "BATCH" }), { params: Promise.resolve({ id: "campaign-1" }) });
        expect(late.status).toBe(409);
        expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it("rejects a non-integer targetCount instead of letting Prisma 500", async () => {
        const response = await PATCH(patchRequest({ targetCount: 1.5 }), { params: Promise.resolve({ id: "campaign-1" }) });

        expect(response.status).toBe(400);
        expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it("returns 400 (not 500) for a malformed JSON body", async () => {
        const response = await PATCH(
            new Request("http://localhost:3001/api/campaigns/campaign-1", { method: "PATCH", body: "{not json" }),
            { params: Promise.resolve({ id: "campaign-1" }) }
        );

        expect(response.status).toBe(400);
    });
});
