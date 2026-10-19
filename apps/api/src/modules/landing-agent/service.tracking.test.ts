import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { mockPrisma, mockCloudflare } = vi.hoisted(() => ({
    mockPrisma: {
        landingCampaign: { findFirst: vi.fn() },
        landingPage: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    },
    mockCloudflare: { publishPageToCloudflare: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: { askAI: vi.fn(), generateImage: vi.fn() } }));
vi.mock("@/modules/learning/EventStore", () => ({ EventStore: { record: vi.fn() }, SystemEventType: {} }));
vi.mock("@/lib/governance/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: vi.fn() }));
vi.mock("@/lib/outboxService", () => ({ OutboxService: { enqueue: vi.fn(), publishEvent: vi.fn() } }));
vi.mock("@/lib/blindIndexService", () => ({ BlindIndexService: { hash: vi.fn(), createBlindIndex: vi.fn() } }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: { requestEntityApproval: vi.fn() } }));
vi.mock("./service/cloudflarePagesService", () => ({ cloudflarePagesService: mockCloudflare }));

import { landingAgentService } from "./service";

function givenPage(status: string) {
    const page = { id: "page-1", status, renderedJson: {} };
    mockPrisma.landingCampaign.findFirst.mockResolvedValue({ id: "campaign-1", teamId: "team-a", assets: [], wireframeOptions: [], pages: [page] });
    mockPrisma.landingPage.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.landingPage.findUniqueOrThrow.mockResolvedValue(page);
}

describe("landingAgentService.savePageTracking", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("stores the cleaned IDs scoped by team without touching the page's status, and skips Cloudflare for a draft", async () => {
        givenPage("draft");

        const result = await landingAgentService.savePageTracking({
            teamId: "team-a",
            campaignId: "campaign-1",
            pageId: "page-1",
            tracking: { ga4Id: "G-ABC1234", gtmId: "", hotjarId: null },
        });

        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledWith({
            where: { id: "page-1", teamId: "team-a" },
            data: { tracking: { ga4Id: "G-ABC1234" } },
        });
        expect(mockCloudflare.publishPageToCloudflare).not.toHaveBeenCalled();
        expect(result.cloudflare).toBeNull();
    });

    it("re-pushes a published page so the connected domain picks up the change", async () => {
        givenPage("published");
        mockCloudflare.publishPageToCloudflare.mockResolvedValue({ status: "pushed" });

        const result = await landingAgentService.savePageTracking({ teamId: "team-a", campaignId: "campaign-1", pageId: "page-1", tracking: { hotjarId: "1234567" } });

        expect(mockCloudflare.publishPageToCloudflare).toHaveBeenCalledWith("page-1");
        expect(result.cloudflare).toEqual({ status: "pushed" });
    });

    it("clears the column when every ID is removed", async () => {
        givenPage("draft");

        await landingAgentService.savePageTracking({ teamId: "team-a", campaignId: "campaign-1", pageId: "page-1", tracking: { ga4Id: "", gtmId: "", hotjarId: "" } });

        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { tracking: Prisma.DbNull } }));
    });

    it("rejects a page that is not in the campaign", async () => {
        givenPage("draft");

        await expect(
            landingAgentService.savePageTracking({ teamId: "team-a", campaignId: "campaign-1", pageId: "other-page", tracking: {} })
        ).rejects.toThrow("Landing page not found");
        expect(mockPrisma.landingPage.updateMany).not.toHaveBeenCalled();
    });
});
