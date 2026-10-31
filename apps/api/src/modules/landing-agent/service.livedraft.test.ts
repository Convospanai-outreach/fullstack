import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// Phase 2: editing a PUBLISHED page writes only the draft columns, so the live
// copy (status, renderedJson, editorState, version) keeps serving until publish.
const { mockPrisma, mockCloudflare } = vi.hoisted(() => ({
    mockPrisma: {
        landingCampaign: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "campaign-1" }),
        },
        landingPage: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
        keywordTrigger: { groupBy: vi.fn().mockResolvedValue([]) },
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
vi.mock("./service/imageGenerationService", () => ({
    imageGenerationService: { generateSectionImage: vi.fn() },
}));

import { landingAgentService } from "./service";
import { imageGenerationService } from "./service/imageGenerationService";

const LIVE_HTML = { html: "<section>live</section>", css: "" };
const DRAFT_HTML = { html: "<section>draft</section>", css: "" };
const WIREFRAME = { sections: [{ id: "w1", title: "Wireframe" }] };

function givenPage(page: Record<string, unknown>) {
    mockPrisma.landingCampaign.findFirst.mockResolvedValue({
        id: "campaign-1",
        teamId: "team-a",
        name: "Campaign",
        assets: [],
        wireframeOptions: [{ id: "wf-1", structure: WIREFRAME }],
        pages: [page],
    });
    mockPrisma.landingPage.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.landingPage.findUniqueOrThrow.mockResolvedValue(page);
}

const publishedPage = {
    id: "page-1",
    title: "Campaign Landing Page",
    slug: "campaign",
    status: "published",
    version: 4,
    editorState: { components: "live" },
    renderedJson: LIVE_HTML,
    draftRenderedJson: null,
    draftEditorState: null,
};

const draftPage = {
    id: "page-1",
    title: "Campaign Landing Page",
    slug: "campaign",
    status: "draft",
    version: 2,
    editorState: { components: "old" },
    renderedJson: LIVE_HTML,
    draftRenderedJson: null,
    draftEditorState: null,
};

describe("saving a published page keeps the live copy untouched (live draft)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("saveEditorState on a published page writes only the draft columns", async () => {
        givenPage(publishedPage);

        await landingAgentService.saveEditorState({
            teamId: "team-a",
            campaignId: "campaign-1",
            editorState: { components: "new" },
            renderedJson: DRAFT_HTML,
        });

        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledTimes(1);
        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledWith({
            where: { id: "page-1", teamId: "team-a" },
            data: {
                title: "Campaign Landing Page",
                draftRenderedJson: DRAFT_HTML,
                draftEditorState: { components: "new" },
            },
        });
    });

    it("saveEditorState on a published page saves the new title to the live column, and nothing else live", async () => {
        givenPage(publishedPage);

        await landingAgentService.saveEditorState({
            teamId: "team-a",
            campaignId: "campaign-1",
            title: "Renamed page",
            editorState: { components: "new" },
            renderedJson: DRAFT_HTML,
        });

        const data = mockPrisma.landingPage.updateMany.mock.calls[0][0].data;
        expect(data).toEqual({
            title: "Renamed page",
            draftRenderedJson: DRAFT_HTML,
            draftEditorState: { components: "new" },
        });
        expect(data).not.toHaveProperty("status");
        expect(data).not.toHaveProperty("renderedJson");
        expect(data).not.toHaveProperty("editorState");
        expect(data).not.toHaveProperty("version");
        expect(mockCloudflare.publishPageToCloudflare).not.toHaveBeenCalled();
    });

    it("saveEditorState on a published page never writes KV", async () => {
        givenPage(publishedPage);

        await landingAgentService.saveEditorState({
            teamId: "team-a",
            campaignId: "campaign-1",
            editorState: { components: "new" },
            renderedJson: DRAFT_HTML,
        });

        expect(mockCloudflare.publishPageToCloudflare).not.toHaveBeenCalled();
    });

    it("saveEditorState on a draft page keeps today's behaviour (live columns, version bump, status kept)", async () => {
        givenPage(draftPage);

        await landingAgentService.saveEditorState({
            teamId: "team-a",
            campaignId: "campaign-1",
            editorState: { components: "new" },
            renderedJson: DRAFT_HTML,
        });

        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledWith({
            where: { id: "page-1", teamId: "team-a" },
            data: expect.objectContaining({
                renderedJson: DRAFT_HTML,
                editorState: { components: "new" },
                version: { increment: 1 },
                status: "draft",
            }),
        });
        const data = mockPrisma.landingPage.updateMany.mock.calls[0][0].data;
        expect(data).not.toHaveProperty("draftRenderedJson");
        expect(data).not.toHaveProperty("draftEditorState");
    });

    it("selectWireframe on a published page writes the draft columns and leaves the live page alone", async () => {
        givenPage(publishedPage);

        await landingAgentService.selectWireframe({ teamId: "team-a", campaignId: "campaign-1", wireframeId: "wf-1" });

        const pageCall = mockPrisma.landingPage.updateMany.mock.calls[0][0];
        expect(pageCall.data).toEqual({ draftRenderedJson: WIREFRAME });
        expect(pageCall.data).not.toHaveProperty("status");
        expect(pageCall.data).not.toHaveProperty("renderedJson");
        expect(pageCall.data).not.toHaveProperty("version");
    });

    it("generateImagesForPage on a published page writes the draft columns, based on the draft when present", async () => {
        givenPage({
            ...publishedPage,
            renderedJson: { sections: [{ id: "sec-1", imagePrompt: "live prompt" }] },
            draftRenderedJson: { sections: [{ id: "sec-1", imagePrompt: "draft prompt" }] },
        });
        (imageGenerationService.generateSectionImage as any).mockResolvedValue({ status: "generated", url: "https://cdn.example.com/x.png" });

        await landingAgentService.generateImagesForPage({ teamId: "team-a", campaignId: "campaign-1", pageId: "page-1" });

        expect(imageGenerationService.generateSectionImage).toHaveBeenCalledWith("draft prompt", "team-a", "page-1-sec-1.png");
        const data = mockPrisma.landingPage.updateMany.mock.calls[0][0].data;
        expect(data).toHaveProperty("draftRenderedJson");
        expect(data).not.toHaveProperty("renderedJson");
        expect(data).not.toHaveProperty("status");
        expect(data).not.toHaveProperty("version");
        expect(mockCloudflare.publishPageToCloudflare).not.toHaveBeenCalled();
    });
});

describe("image generation on a published page returns what the editor should show", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the new draft (with the image) rather than the live content, and flags unpublished changes", async () => {
        const live = { sections: [{ id: "sec-1", imagePrompt: "live prompt" }] };
        const newDraft = { sections: [{ id: "sec-1", imagePrompt: "draft prompt", imageUrl: "https://cdn.example.com/x.png" }] };
        givenPage({ ...publishedPage, renderedJson: live, draftRenderedJson: { sections: [{ id: "sec-1", imagePrompt: "draft prompt" }] } });
        mockPrisma.landingPage.findUniqueOrThrow.mockResolvedValue({ ...publishedPage, renderedJson: live, draftRenderedJson: newDraft });
        (imageGenerationService.generateSectionImage as any).mockResolvedValue({ status: "generated", url: "https://cdn.example.com/x.png" });

        const result = (await landingAgentService.generateImagesForPage({ teamId: "team-a", campaignId: "campaign-1", pageId: "page-1" })) as any;

        expect(result.renderedJson).toEqual(newDraft);
        expect(result.hasUnpublishedChanges).toBe(true);
    });
});

describe("discarding unpublished changes (live draft)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("clears both draft columns, scoped by team, and leaves the live page and KV alone", async () => {
        givenPage({ ...publishedPage, draftRenderedJson: DRAFT_HTML, draftEditorState: { components: "draft" } });

        await landingAgentService.discardPageDraft({ teamId: "team-a", campaignId: "campaign-1", pageId: "page-1" });

        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledTimes(1);
        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledWith({
            where: { id: "page-1", teamId: "team-a" },
            data: { draftRenderedJson: Prisma.DbNull, draftEditorState: Prisma.DbNull },
        });
        expect(mockCloudflare.publishPageToCloudflare).not.toHaveBeenCalled();
    });

    it("is a no-op-safe call on a page that has no draft", async () => {
        givenPage(publishedPage);

        await expect(
            landingAgentService.discardPageDraft({ teamId: "team-a", campaignId: "campaign-1", pageId: "page-1" })
        ).resolves.toBeDefined();
    });

    it("denies a campaign that belongs to another team", async () => {
        mockPrisma.landingCampaign.findFirst.mockResolvedValue(null);

        await expect(
            landingAgentService.discardPageDraft({ teamId: "team-b", campaignId: "campaign-1", pageId: "page-1" })
        ).rejects.toThrow("Landing campaign not found");
        expect(mockPrisma.landingPage.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a page that is not in the campaign", async () => {
        givenPage(publishedPage);

        await expect(
            landingAgentService.discardPageDraft({ teamId: "team-a", campaignId: "campaign-1", pageId: "other-page" })
        ).rejects.toThrow("Landing page not found");
        expect(mockPrisma.landingPage.updateMany).not.toHaveBeenCalled();
    });
});

describe("editor reads return the unpublished draft (live draft)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("getCampaign shows the draft content and flags unpublished changes on a published page", async () => {
        givenPage({ ...publishedPage, draftRenderedJson: DRAFT_HTML, draftEditorState: { components: "draft" } });

        const campaign = await landingAgentService.getCampaign("team-a", "campaign-1");

        const page = campaign.pages[0] as any;
        expect(page.renderedJson).toEqual(DRAFT_HTML);
        expect(page.editorState).toEqual({ components: "draft" });
        expect(page.hasUnpublishedChanges).toBe(true);
        expect(page.status).toBe("published");
        expect(page).not.toHaveProperty("draftRenderedJson");
        expect(page).not.toHaveProperty("draftEditorState");
    });

    it("getCampaign keeps the live content, with the flag off, when there is no draft", async () => {
        givenPage(publishedPage);

        const campaign = await landingAgentService.getCampaign("team-a", "campaign-1");

        const page = campaign.pages[0] as any;
        expect(page.renderedJson).toEqual(LIVE_HTML);
        expect(page.hasUnpublishedChanges).toBe(false);
    });

    it("getCampaign falls back to the live editor state when the draft has none", async () => {
        givenPage({ ...publishedPage, draftRenderedJson: DRAFT_HTML, draftEditorState: null });

        const campaign = await landingAgentService.getCampaign("team-a", "campaign-1");

        expect((campaign.pages[0] as any).editorState).toEqual({ components: "live" });
    });

    it("getCampaign denies a campaign that belongs to another team", async () => {
        mockPrisma.landingCampaign.findFirst.mockResolvedValue(null);

        await expect(landingAgentService.getCampaign("team-b", "campaign-1")).rejects.toThrow("Landing campaign not found");
        expect(mockPrisma.landingCampaign.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "campaign-1", teamId: "team-b" } }));
    });

    it("listCampaigns flags pages with unpublished changes and never returns the draft body", async () => {
        mockPrisma.landingCampaign.findMany.mockResolvedValue([
            { id: "c1", name: "A", updatedAt: new Date(), pages: [{ id: "page-a", slug: "a", title: "A", status: "published", updatedAt: new Date(), draftRenderedJson: DRAFT_HTML }], _count: { wireframeOptions: 0, leads: 0 } },
            { id: "c2", name: "B", updatedAt: new Date(), pages: [{ id: "page-b", slug: "b", title: "B", status: "published", updatedAt: new Date(), draftRenderedJson: null }], _count: { wireframeOptions: 0, leads: 0 } },
        ]);

        const campaigns = await landingAgentService.listCampaigns("team-a");

        expect(campaigns[0].pages[0]).toMatchObject({ slug: "a", status: "published", hasUnpublishedChanges: true });
        expect(campaigns[0].pages[0]).not.toHaveProperty("draftRenderedJson");
        expect(campaigns[1].pages[0]).toMatchObject({ slug: "b", hasUnpublishedChanges: false });
        expect(mockPrisma.landingCampaign.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a" } }));
    });
});
