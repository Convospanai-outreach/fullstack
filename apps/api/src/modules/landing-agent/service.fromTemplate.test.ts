import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        iCP: { findFirst: vi.fn(), create: vi.fn() },
        team: { findUnique: vi.fn().mockResolvedValue(null) },
        landingCampaign: { create: vi.fn() },
        landingPage: { findUnique: vi.fn(), create: vi.fn() },
        landingExperiment: { findUnique: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(),
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
// Starting from a template must never reach the AI client: every method throws if it is called.
vi.mock("@/lib/aiService", () => ({
    aiService: new Proxy(
        {},
        {
            get: () => () => {
                throw new Error("AI must not run on the template path");
            },
        },
    ),
}));
vi.mock("@/modules/learning/EventStore", () => ({ EventStore: { record: vi.fn() }, SystemEventType: {} }));
vi.mock("@/lib/governance/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: vi.fn() }));
vi.mock("@/lib/outboxService", () => ({ OutboxService: { enqueue: vi.fn(), publishEvent: vi.fn() } }));
vi.mock("@/lib/blindIndexService", () => ({ BlindIndexService: { hash: vi.fn(), createBlindIndex: vi.fn() } }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: { requestEntityApproval: vi.fn() } }));
vi.mock("./service/imageGenerationService", () => ({
    imageGenerationService: { generateSectionImage: vi.fn() },
}));

import { landingAgentService } from "./service";
import { APIError } from "@/lib/apiResponse";
import { decodeLeadFormMarkerId } from "./leadFormConfig";
import { findLeadFormMarkers } from "./leadFormHtml";
import { getLandingTemplate } from "./landingTemplates";

const ENV = { NEXTAUTH_URL: "https://app.example" };

function createInput(overrides: Record<string, unknown> = {}) {
    return {
        teamId: "team-1",
        userId: "user-1",
        templateId: "free-guide",
        name: "  Spring guide  ",
        env: ENV,
        ...overrides,
    };
}

function savedRenderedJson(): { html: string; css: string } {
    const call = mockPrisma.landingPage.create.mock.calls[0]?.[0] as { data: { renderedJson: { html: string; css: string } } };
    return call.data.renderedJson;
}

describe("landingAgentService.createCampaignFromTemplate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma));
        mockPrisma.iCP.findFirst.mockResolvedValue(null);
        mockPrisma.iCP.create.mockResolvedValue({ id: "icp-1" });
        mockPrisma.landingCampaign.create.mockResolvedValue({ id: "lc-1" });
        mockPrisma.landingPage.findUnique.mockResolvedValue(null);
        mockPrisma.landingPage.create.mockResolvedValue({ id: "lp-1" });
    });

    it("creates a campaign and a draft page from a template, with no AI call", async () => {
        const result = await landingAgentService.createCampaignFromTemplate(createInput());

        expect(result).toEqual({ campaignId: "lc-1", pageId: "lp-1" });
        const page = mockPrisma.landingPage.create.mock.calls[0]?.[0]?.data;
        expect(page.status).toBe("draft");
        expect(page.version).toBe(1);
        expect(page.campaignId).toBe("lc-1");
        expect(typeof page.slug).toBe("string");
        expect(savedRenderedJson().html).toContain("la-section");
    });

    it("saves the template's lead form as a marker that decodes to the template config", async () => {
        await landingAgentService.createCampaignFromTemplate(createInput());

        const markers = findLeadFormMarkers(savedRenderedJson().html);
        expect(markers).toHaveLength(1);
        expect(decodeLeadFormMarkerId(markers[0]!.id)).toEqual(getLandingTemplate("free-guide")!.leadForm);
    });

    it("writes image URLs as absolute URLs on the canonical origin", async () => {
        await landingAgentService.createCampaignFromTemplate(createInput({ templateId: "dm-keyword-offer" }));

        const html = savedRenderedJson().html;
        expect(html).toContain('src="https://app.example/landing-assets/');
        expect(html).not.toContain('src="/landing-assets/');
    });

    it("creates the team's default audience and links the campaign to it", async () => {
        await landingAgentService.createCampaignFromTemplate(createInput());

        expect(mockPrisma.iCP.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ teamId: "team-1" }) }));
        expect(mockPrisma.iCP.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ teamId: "team-1", name: "Default audience", status: "active" }),
            }),
        );
        const campaign = mockPrisma.landingCampaign.create.mock.calls[0]?.[0]?.data;
        expect(campaign).toEqual(expect.objectContaining({ teamId: "team-1", ownerId: "user-1", icpId: "icp-1", name: "Spring guide", status: "draft" }));
    });

    it("reuses the team's existing default audience instead of creating another", async () => {
        mockPrisma.iCP.findFirst.mockResolvedValue({ id: "icp-existing" });

        await landingAgentService.createCampaignFromTemplate(createInput());

        expect(mockPrisma.iCP.create).not.toHaveBeenCalled();
        expect(mockPrisma.landingCampaign.create.mock.calls[0]?.[0]?.data.icpId).toBe("icp-existing");
    });

    it("scopes the page to the team", async () => {
        await landingAgentService.createCampaignFromTemplate(createInput());

        expect(mockPrisma.landingPage.create.mock.calls[0]?.[0]?.data.teamId).toBe("team-1");
    });

    it("rejects an unknown template id before writing anything", async () => {
        await expect(landingAgentService.createCampaignFromTemplate(createInput({ templateId: "nope" }))).rejects.toBeInstanceOf(APIError);

        expect(mockPrisma.landingCampaign.create).not.toHaveBeenCalled();
        expect(mockPrisma.landingPage.create).not.toHaveBeenCalled();
    });
});

describe("landingAgentService.createCampaignFromTemplate with a page address", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma));
        mockPrisma.iCP.findFirst.mockResolvedValue(null);
        mockPrisma.iCP.create.mockResolvedValue({ id: "icp-1" });
        mockPrisma.landingCampaign.create.mockResolvedValue({ id: "lc-1" });
        mockPrisma.landingPage.findUnique.mockResolvedValue(null);
        mockPrisma.landingPage.create.mockResolvedValue({ id: "lp-1" });
    });

    it("uses the requested path as the page's slug", async () => {
        await landingAgentService.createCampaignFromTemplate(createInput({ path: "spring-guide" }));

        expect(mockPrisma.landingPage.create.mock.calls[0]?.[0]?.data.slug).toBe("spring-guide");
    });

    it("refuses a path another page already uses, and creates nothing", async () => {
        mockPrisma.landingPage.findUnique.mockResolvedValue({ id: "lp-other" });

        const attempt = landingAgentService.createCampaignFromTemplate(createInput({ path: "spring-guide" }));

        await expect(attempt).rejects.toThrow("This web address is taken");
        expect(mockPrisma.landingCampaign.create).not.toHaveBeenCalled();
        expect(mockPrisma.landingPage.create).not.toHaveBeenCalled();
    });

    it("keeps the generated slug when no path is given", async () => {
        await landingAgentService.createCampaignFromTemplate(createInput());

        expect(mockPrisma.landingPage.create.mock.calls[0]?.[0]?.data.slug).toBe("spring-guide");
    });
});
