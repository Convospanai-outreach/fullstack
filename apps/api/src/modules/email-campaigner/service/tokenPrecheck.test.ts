import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        campaign: { findFirst: vi.fn() },
        campaignSequence: { findFirst: vi.fn() },
        lead: { findMany: vi.fn() },
    },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { checkCampaignTokens } from "./tokenPrecheck";

const step = (over: Record<string, unknown> = {}) => ({ id: "s1", stepOrder: 1, stepType: "EMAIL", subject: "Hi {{firstName}}", body: "Hi {{firstName}} at {{company}}", ...over });
const lead = (id: string, over: Record<string, unknown> = {}) => ({ id, fullName: `Person ${id}`, email: `${id}@x.test`, company: "Acme", jobTitle: null, location: null, customFields: {}, ...over });

beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.campaign.findFirst.mockResolvedValue({ id: "c1" });
});

describe("checkCampaignTokens", () => {
    it("returns null for a campaign that is not the team's", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);
        expect(await checkCampaignTokens("team-2", "c1")).toBeNull();
        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", teamId: "team-2" } }));
    });

    it("counts the contacts each missing field would hold, once per contact even if it is in subject and body", async () => {
        mockPrisma.campaignSequence.findFirst.mockResolvedValue({ steps: [step()] });
        mockPrisma.lead.findMany.mockResolvedValue([
            lead("a", { fullName: null }),
            lead("b", { fullName: null }),
            lead("c", { fullName: null }),
            lead("d", { fullName: null }),
            lead("e"),
            lead("f", { company: null }),
        ]);

        const report = (await checkCampaignTokens("team-1", "c1"))!;

        expect(report.leadsChecked).toBe(6);
        expect(report.steps[0]).toMatchObject({ stepId: "s1", contactsHeld: 5 });
        const first = report.steps[0]!.issues.find((i) => i.token === "firstName")!;
        expect(first).toMatchObject({ reason: "empty", suggestedFallback: "there", leadsAffected: 4 });
        expect(first.sampleLeads).toHaveLength(3);
        expect(report.steps[0]!.issues.find((i) => i.token === "company")).toMatchObject({ leadsAffected: 1 });
    });

    it("flags a mistyped field for every contact, with a did-you-mean", async () => {
        mockPrisma.campaignSequence.findFirst.mockResolvedValue({ steps: [step({ subject: "Hello", body: "Hi {{firstNam}}" })] });
        mockPrisma.lead.findMany.mockResolvedValue([lead("a"), lead("b")]);

        const [issue] = (await checkCampaignTokens("team-1", "c1"))!.steps[0]!.issues;

        expect(issue).toMatchObject({ token: "firstNam", reason: "unknown", leadsAffected: 2 });
        expect(issue!.advice).toContain("{{firstName}}");
    });

    it("skips steps that are not email and steps with no body, and reports a clean step as no issues", async () => {
        mockPrisma.campaignSequence.findFirst.mockResolvedValue({
            steps: [step({ id: "li", stepType: "LI_VISIT" }), step({ id: "empty", body: "  " }), step({ id: "ok", body: "No fields here", subject: "Hello" })],
        });
        mockPrisma.lead.findMany.mockResolvedValue([lead("a")]);

        const report = (await checkCampaignTokens("team-1", "c1"))!;

        expect(report.steps.map((s) => s.stepId)).toEqual(["ok"]);
        expect(report.steps[0]).toMatchObject({ contactsHeld: 0, issues: [] });
    });

    it("scopes the lead lookup to the campaign and team", async () => {
        mockPrisma.campaignSequence.findFirst.mockResolvedValue({ steps: [step()] });
        mockPrisma.lead.findMany.mockResolvedValue([]);
        await checkCampaignTokens("team-1", "c1");
        expect(mockPrisma.lead.findMany.mock.calls[0]![0].where).toEqual({ campaignId: "c1", teamId: "team-1" });
        expect(mockPrisma.campaignSequence.findFirst.mock.calls[0]![0].where).toEqual({ campaignId: "c1", teamId: "team-1" });
    });
});
