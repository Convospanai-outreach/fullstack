import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// publishCampaign runs the Cloudflare edge push AFTER the DB transaction commits.
// These tests pin the fix for F-16: the returned object must surface the edge-push
// outcome (skipped / error) so the UI can't report an unqualified success when the
// page never actually reached Cloudflare.

const { mockPrisma, mockTx, publishPageToCloudflare } = vi.hoisted(() => {
    const tx = {
        landingPage: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "page-1", slug: "my-campaign" }),
        },
        landingCampaign: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "camp-1" }),
        },
    };
    return {
        mockTx: tx,
        publishPageToCloudflare: vi.fn(),
        mockPrisma: {
            landingCampaign: {
                findFirst: vi.fn().mockResolvedValue({
                    id: "camp-1",
                    name: "My Campaign",
                    pages: [{ id: "page-1", slug: "my-campaign" }],
                }),
            },
            landingPage: { findUnique: vi.fn() },
            customDomain: { findFirst: vi.fn() },
            $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
        },
    };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: {} }));
vi.mock("@/modules/learning/EventStore", () => ({ EventStore: {}, SystemEventType: {} }));
vi.mock("@/lib/governance/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: vi.fn() }));
vi.mock("@/lib/outboxService", () => ({ OutboxService: { publishEvent: vi.fn() } }));
vi.mock("@/lib/blindIndexService", () => ({ BlindIndexService: {} }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: {} }));
vi.mock("./service/cloudflarePagesService", () => ({
    cloudflarePagesService: { publishPageToCloudflare },
}));

import { landingAgentService } from "./service";

describe("landingAgentService.publishCampaign - edge-push outcome", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("surfaces a skipped edge push instead of reporting unqualified success", async () => {
        publishPageToCloudflare.mockResolvedValue({ status: "skipped", details: "not configured" });

        const result = await landingAgentService.publishCampaign({
            teamId: "team-1",
            userId: "user-1",
            campaignId: "camp-1",
            requireApproval: false,
        });

        expect(result.status).toBe("PUBLISHED");
        expect(result.cloudflare).toEqual({ status: "skipped" });
        // No Cloudflare copy means a connected domain can't serve the page.
        expect(result.liveDomain).toBeNull();
        expect(mockPrisma.customDomain.findFirst).not.toHaveBeenCalled();
    });

    it("surfaces an errored edge push (status only, no raw details leaked to the caller)", async () => {
        publishPageToCloudflare.mockResolvedValue({ status: "error", details: "Cloudflare KV write failed: 403 forbidden" });

        const result = await landingAgentService.publishCampaign({
            teamId: "team-1",
            userId: "user-1",
            campaignId: "camp-1",
            requireApproval: false,
        });

        expect(result.cloudflare).toEqual({ status: "error" });
        expect(JSON.stringify(result.cloudflare)).not.toContain("forbidden");
    });

    it("reports a pushed edge push on the happy path", async () => {
        publishPageToCloudflare.mockResolvedValue({ status: "pushed" });

        const result = await landingAgentService.publishCampaign({
            teamId: "team-1",
            userId: "user-1",
            campaignId: "camp-1",
            requireApproval: false,
        });

        expect(result.cloudflare).toEqual({ status: "pushed" });
    });

    it("returns the team's active connected domain once the page is on Cloudflare", async () => {
        publishPageToCloudflare.mockResolvedValue({ status: "pushed" });
        mockPrisma.customDomain.findFirst.mockResolvedValue({ domain: "go.example.com" });

        const result = await landingAgentService.publishCampaign({
            teamId: "team-1",
            userId: "user-1",
            campaignId: "camp-1",
            requireApproval: false,
        });

        expect(result.liveDomain).toBe("go.example.com");
        expect(mockPrisma.customDomain.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teamId: "team-1", status: "active" } })
        );
    });
});

describe("landingAgentService.publishCampaign - live draft (Phase 2)", () => {
    const LIVE = { html: "<section>live</section>", css: "" };
    const DRAFT = { html: "<section>draft</section>", css: "" };

    beforeEach(() => {
        vi.clearAllMocks();
        publishPageToCloudflare.mockResolvedValue({ status: "pushed" });
    });

    function givenCurrentPage(current: Record<string, unknown>) {
        mockPrisma.landingCampaign.findFirst.mockResolvedValueOnce({
            id: "camp-1",
            name: "My Campaign",
            pages: [{ id: "page-1", slug: "my-campaign" }],
        });
        // The first read inside the transaction is the page as it stands right before the copy.
        mockTx.landingPage.findUniqueOrThrow.mockResolvedValueOnce({ id: "page-1", slug: "my-campaign", ...current });
    }

    it("copies the draft to the live columns, bumps version, clears the draft and pushes to KV", async () => {
        givenCurrentPage({
            version: 3,
            renderedJson: LIVE,
            editorState: { components: "live" },
            draftRenderedJson: DRAFT,
            draftEditorState: { components: "draft" },
        });

        await landingAgentService.publishCampaign({ teamId: "team-1", userId: "user-1", campaignId: "camp-1", requireApproval: false });

        expect(mockTx.landingPage.updateMany).toHaveBeenCalledWith({
            where: { id: "page-1", teamId: "team-1" },
            data: expect.objectContaining({
                status: "published",
                renderedJson: DRAFT,
                editorState: { components: "draft" },
                version: { increment: 1 },
                draftRenderedJson: Prisma.DbNull,
                draftEditorState: Prisma.DbNull,
            }),
        });
        expect(publishPageToCloudflare).toHaveBeenCalledWith("page-1");
    });

    it("keeps the live editor state when the draft has none, and still clears the draft columns", async () => {
        givenCurrentPage({ version: 3, renderedJson: LIVE, editorState: { components: "live" }, draftRenderedJson: DRAFT, draftEditorState: null });

        await landingAgentService.publishCampaign({ teamId: "team-1", userId: "user-1", campaignId: "camp-1", requireApproval: false });

        const data = mockTx.landingPage.updateMany.mock.calls[0][0].data;
        expect(data).toMatchObject({ renderedJson: DRAFT, draftRenderedJson: Prisma.DbNull, draftEditorState: Prisma.DbNull });
        expect(data).not.toHaveProperty("editorState");
    });

    it("a page with no draft publishes exactly as before: no copy, no version bump", async () => {
        givenCurrentPage({ version: 3, renderedJson: LIVE, editorState: null, draftRenderedJson: null, draftEditorState: null });

        await landingAgentService.publishCampaign({ teamId: "team-1", userId: "user-1", campaignId: "camp-1", requireApproval: false });

        const data = mockTx.landingPage.updateMany.mock.calls[0][0].data;
        expect(data).toEqual(expect.objectContaining({ status: "published" }));
        expect(data).not.toHaveProperty("renderedJson");
        expect(data).not.toHaveProperty("version");
        expect(data).not.toHaveProperty("draftRenderedJson");
        expect(publishPageToCloudflare).toHaveBeenCalledWith("page-1");
    });
});
