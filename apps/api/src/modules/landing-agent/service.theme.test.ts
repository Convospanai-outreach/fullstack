import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        iCP: { findFirst: vi.fn(), create: vi.fn() },
        team: { findUnique: vi.fn() },
        landingCampaign: { create: vi.fn(), findFirst: vi.fn() },
        landingPage: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
        $transaction: vi.fn(),
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: new Proxy({}, { get: () => () => { throw new Error("AI must not run"); } }) }));
vi.mock("@/modules/learning/EventStore", () => ({ EventStore: { record: vi.fn() }, SystemEventType: {} }));
vi.mock("@/lib/governance/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: vi.fn() }));
vi.mock("@/lib/outboxService", () => ({ OutboxService: { enqueue: vi.fn(), publishEvent: vi.fn() } }));
vi.mock("@/lib/blindIndexService", () => ({ BlindIndexService: { hash: vi.fn(), createBlindIndex: vi.fn() } }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: { requestEntityApproval: vi.fn() } }));
vi.mock("./service/imageGenerationService", () => ({ imageGenerationService: { generateSectionImage: vi.fn() } }));

import { landingAgentService } from "./service";

const ENV = { NEXTAUTH_URL: "https://app.example" };

function savedRenderedJson(): Record<string, unknown> {
    const call = mockPrisma.landingPage.create.mock.calls[0]?.[0] as { data: { renderedJson: Record<string, unknown> } };
    return call.data.renderedJson;
}

function createFromTemplate() {
    return landingAgentService.createCampaignFromTemplate({
        teamId: "team-1",
        userId: "user-1",
        templateId: "free-guide",
        name: "Spring guide",
        env: ENV,
    });
}

describe("page theme: brand seeding on create", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma));
        mockPrisma.iCP.findFirst.mockResolvedValue({ id: "icp-1" });
        mockPrisma.landingCampaign.create.mockResolvedValue({ id: "campaign-1" });
        mockPrisma.landingPage.create.mockResolvedValue({ id: "page-1" });
        mockPrisma.landingPage.findUnique.mockResolvedValue(null);
    });

    it("seeds the theme colours from the team's branding", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({ branding: { primaryColor: "#112233", accentColor: "#ABCDEF", portalTitle: "Acme" } });
        await createFromTemplate();
        expect(mockPrisma.team.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "team-1" } }));
        expect(savedRenderedJson()["theme"]).toEqual({ primary: "#112233", accent: "#ABCDEF" });
    });

    it("leaves the page unthemed when the team has no valid brand colour", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({ branding: { primaryColor: "#fff" } });
        await createFromTemplate();
        expect(savedRenderedJson()).not.toHaveProperty("theme");
    });

    it("leaves the page unthemed when the team has no branding at all", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({ branding: null });
        await createFromTemplate();
        expect(savedRenderedJson()).not.toHaveProperty("theme");
    });
});

describe("page theme: save-time validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.landingCampaign.findFirst.mockResolvedValue({
            id: "campaign-1",
            teamId: "team-1",
            pages: [{ id: "page-1", slug: "spring", title: "Spring", status: "draft", renderedJson: { html: "", css: "" } }],
        });
    });

    it("rejects a theme with an unknown preset before anything is written", async () => {
        await expect(
            landingAgentService.saveEditorState({
                teamId: "team-1",
                campaignId: "campaign-1",
                renderedJson: { html: "<p>x</p>", css: "", theme: { preset: "neon", primary: "#112233", accent: "#abcdef" } },
            })
        ).rejects.toThrow(/theme/i);
        expect(mockPrisma.landingPage.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a theme with a non-hex colour", async () => {
        await expect(
            landingAgentService.saveEditorState({
                teamId: "team-1",
                campaignId: "campaign-1",
                renderedJson: { html: "<p>x</p>", css: "", theme: { primary: "javascript:1", accent: "#abcdef" } },
            })
        ).rejects.toThrow(/theme/i);
        expect(mockPrisma.landingPage.updateMany).not.toHaveBeenCalled();
    });
});
