import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        landingCampaign: { findFirst: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
        landingPage: { findUnique: vi.fn(), create: vi.fn() },
        landingExperiment: { findUnique: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: {} }));
vi.mock("@/modules/learning/EventStore", () => ({ EventStore: { record: vi.fn() }, SystemEventType: {} }));
vi.mock("@/lib/governance/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: vi.fn() }));
vi.mock("@/lib/outboxService", () => ({ OutboxService: { enqueue: vi.fn(), publishEvent: vi.fn() } }));
vi.mock("@/lib/blindIndexService", () => ({ BlindIndexService: { hash: vi.fn(), createBlindIndex: vi.fn() } }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: { requestEntityApproval: vi.fn() } }));
vi.mock("./service/imageGenerationService", () => ({ imageGenerationService: { generateSectionImage: vi.fn() } }));

import { landingAgentService } from "./service";
import { selectWireframeSchema } from "./schemas";
import { APIError } from "@/lib/apiResponse";

const WIREFRAME_ID = "11111111-2222-4333-8444-555555555555";

function campaignWithoutPage() {
    return {
        id: "lc-1",
        teamId: "team-1",
        name: "Spring Guide",
        selectedWireframeId: null,
        wireframeOptions: [{ id: WIREFRAME_ID, structure: { sections: [] } }],
        pages: [],
    };
}

describe("landingAgentService.selectWireframe with a page address", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.landingCampaign.findFirst.mockResolvedValue(campaignWithoutPage());
        mockPrisma.landingCampaign.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.landingCampaign.findUniqueOrThrow.mockResolvedValue({ id: "lc-1" });
        mockPrisma.landingPage.findUnique.mockResolvedValue(null);
        mockPrisma.landingExperiment.findUnique.mockResolvedValue(null);
        mockPrisma.landingPage.create.mockResolvedValue({ id: "lp-1" });
    });

    it("creates the page at the chosen path", async () => {
        await landingAgentService.selectWireframe({ teamId: "team-1", campaignId: "lc-1", wireframeId: WIREFRAME_ID, path: "spring-offer" });

        expect(mockPrisma.landingPage.create.mock.calls[0]?.[0]?.data.slug).toBe("spring-offer");
    });

    it("generates the address from the campaign name when no path is given", async () => {
        await landingAgentService.selectWireframe({ teamId: "team-1", campaignId: "lc-1", wireframeId: WIREFRAME_ID });

        expect(mockPrisma.landingPage.create.mock.calls[0]?.[0]?.data.slug).toBe("spring-guide");
    });

    it("refuses a path another page already uses, and creates nothing", async () => {
        mockPrisma.landingPage.findUnique.mockResolvedValue({ id: "lp-other" });

        const attempt = landingAgentService.selectWireframe({ teamId: "team-1", campaignId: "lc-1", wireframeId: WIREFRAME_ID, path: "spring-offer" });

        await expect(attempt).rejects.toMatchObject({ message: "This web address is taken. Try another.", statusCode: 409 });
        expect(mockPrisma.landingPage.create).not.toHaveBeenCalled();
    });

    it("answers the same taken message when another request takes the path first", async () => {
        mockPrisma.landingPage.create.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: ["slug"] } }));

        const attempt = landingAgentService.selectWireframe({ teamId: "team-1", campaignId: "lc-1", wireframeId: WIREFRAME_ID, path: "spring-offer" });

        await expect(attempt).rejects.toBeInstanceOf(APIError);
        await expect(attempt).rejects.toMatchObject({ message: "This web address is taken. Try another.", statusCode: 409 });
    });
});

describe("selectWireframeSchema path", () => {
    it("accepts a wireframe id with no path, as before", () => {
        expect(selectWireframeSchema.safeParse({ wireframeId: WIREFRAME_ID }).success).toBe(true);
    });

    it("accepts a valid path", () => {
        expect(selectWireframeSchema.safeParse({ wireframeId: WIREFRAME_ID, path: "spring-offer" }).success).toBe(true);
    });

    it("refuses a malformed or reserved path", () => {
        expect(selectWireframeSchema.safeParse({ wireframeId: WIREFRAME_ID, path: "a" }).success).toBe(false);
        expect(selectWireframeSchema.safeParse({ wireframeId: WIREFRAME_ID, path: "thank-you" }).success).toBe(false);
    });
});
