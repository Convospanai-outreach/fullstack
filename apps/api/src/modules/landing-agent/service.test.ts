import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        landingCampaign: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
        landingPage: { update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: { askAI: vi.fn(), generateImage: vi.fn() } }));
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
import { imageGenerationService } from "./service/imageGenerationService";

describe("landingAgentService's mutations scope by teamId, not just the campaign pre-check", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("generateImagesForPage scopes the final renderedJson write by teamId and surfaces a lost race instead of silently succeeding", async () => {
        const page = {
            id: "page-1",
            title: "t",
            status: "draft",
            renderedJson: { sections: [{ id: "sec-1", imagePrompt: "a hero image", imageUrl: undefined }] },
        };
        mockPrisma.landingCampaign.findFirst.mockResolvedValue({
            id: "campaign-1",
            teamId: "team-a",
            assets: [],
            wireframeOptions: [],
            pages: [page],
        });
        (imageGenerationService.generateSectionImage as any).mockResolvedValue({ status: "generated", url: "https://cdn.example.com/x.png" });
        mockPrisma.landingPage.updateMany.mockResolvedValue({ count: 0 });

        await expect(
            landingAgentService.generateImagesForPage({ teamId: "team-a", campaignId: "campaign-1", pageId: "page-1" })
        ).rejects.toThrow("Landing page not found");

        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "page-1", teamId: "team-a" } })
        );
        expect(mockPrisma.landingPage.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it("generateImagesForPage returns the updated page when the scoped write succeeds", async () => {
        const page = {
            id: "page-1",
            title: "t",
            status: "draft",
            renderedJson: { sections: [{ id: "sec-1", imagePrompt: "a hero image", imageUrl: undefined }] },
        };
        mockPrisma.landingCampaign.findFirst.mockResolvedValue({
            id: "campaign-1",
            teamId: "team-a",
            assets: [],
            wireframeOptions: [],
            pages: [page],
        });
        (imageGenerationService.generateSectionImage as any).mockResolvedValue({ status: "generated", url: "https://cdn.example.com/x.png" });
        mockPrisma.landingPage.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.landingPage.findUniqueOrThrow.mockResolvedValue({ ...page, renderedJson: { sections: [] } });

        const result = await landingAgentService.generateImagesForPage({ teamId: "team-a", campaignId: "campaign-1", pageId: "page-1" });

        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "page-1", teamId: "team-a" } })
        );
        expect(result).toEqual({ ...page, renderedJson: { sections: [] } });
    });
});

describe("landingAgentService.submitLeadBySlug", () => {
    it("stores the creator funnel link token with the sign-up so the intake can merge it", async () => {
        const tx = { landingLead: { create: vi.fn().mockResolvedValue({ id: "ll-1" }) }, landingEvent: { create: vi.fn() } };
        (mockPrisma as any).$transaction = vi.fn((run: (t: typeof tx) => unknown) => run(tx));
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue({ id: "lp-1", campaignId: "lc-1", teamId: "team-1", slug: "guide", version: 1 } as any);

        await landingAgentService.submitLeadBySlug({ slug: "guide", payload: { name: "Asha", socialToken: "abc.def" } });

        expect(tx.landingLead.create).toHaveBeenCalledWith({ data: expect.objectContaining({ teamId: "team-1", socialToken: "abc.def" }) });
    });

    it("keeps a WhatsApp opt-in tick only from a creator funnel page and with a phone number", async () => {
        const tx = { landingLead: { create: vi.fn().mockResolvedValue({ id: "ll-1" }) }, landingEvent: { create: vi.fn() } };
        (mockPrisma as any).$transaction = vi.fn((run: (t: typeof tx) => unknown) => run(tx));
        const page = { id: "lp-1", campaignId: "lc-1", teamId: "team-1", slug: "guide", version: 1 };
        const spy = vi.spyOn(landingAgentService, "getPublicPageBySlug");
        const stored = () => tx.landingLead.create.mock.calls.at(-1)![0].data.whatsappConsent;

        spy.mockResolvedValue({ ...page, funnelStage: "TOFU" } as any);
        await landingAgentService.submitLeadBySlug({ slug: "guide", payload: { phone: "+91 98765 43210", whatsappConsent: true } });
        expect(stored()).toBe(true);
        await landingAgentService.submitLeadBySlug({ slug: "guide", payload: { phone: " ", whatsappConsent: true } });
        expect(stored()).toBeUndefined();

        spy.mockResolvedValue({ ...page, funnelStage: null } as any);
        await landingAgentService.submitLeadBySlug({ slug: "guide", payload: { phone: "+91 98765 43210", whatsappConsent: true } });
        expect(stored()).toBeUndefined();
    });
});

describe("landingAgentService.trackEventBySlug", () => {
    it("stores the page URL's UTM with the event", async () => {
        (mockPrisma as any).landingEvent = { create: vi.fn().mockResolvedValue({ id: "ev-1" }) };
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue({ id: "lp-1", campaignId: "lc-1", teamId: "team-1", slug: "guide", version: 1 } as any);

        await landingAgentService.trackEventBySlug({ slug: "guide", eventName: "page_view", utmSource: "instagram", utmMedium: "comment", utmContent: "post-1" });

        expect((mockPrisma as any).landingEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ teamId: "team-1", eventName: "page_view", utmSource: "instagram", utmMedium: "comment", utmCampaign: undefined, utmContent: "post-1" }),
        });
    });
});
