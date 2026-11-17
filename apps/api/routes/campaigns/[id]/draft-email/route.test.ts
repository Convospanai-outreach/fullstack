import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockCompose, mockContext, mockAuthorize } = vi.hoisted(() => ({
    mockPrisma: { campaign: { findFirst: vi.fn() } },
    mockCompose: vi.fn(),
    mockContext: vi.fn(),
    mockAuthorize: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockContext }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: mockAuthorize, TeamRole: { MEMBER: "member" } }));
vi.mock("@/modules/email-campaigner/service/emailComposer", () => ({ composeNodeA: mockCompose }));

import { POST } from "./route";

const ctx = { params: Promise.resolve({ id: "camp-1" }) };
const post = (body: unknown) => new Request("http://localhost/api/campaigns/camp-1/draft-email", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/campaigns/[id]/draft-email", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockContext.mockResolvedValue({ userId: "u1", teamId: "team-1" });
        mockAuthorize.mockResolvedValue(undefined);
        mockPrisma.campaign.findFirst.mockResolvedValue({
            name: "Q4 push",
            aiConfig: { tone: "warm", context: "We help clinics fill appointment gaps" },
            icp: { name: "Clinics", description: null, criteria: { industry: "Healthcare", geographies: ["India"] } },
            team: { name: "Acme", aiConfig: { signOff: "Best" } },
        });
        mockCompose.mockResolvedValue({ subject: "Hi {{firstName|there}}", body: "Body", internal_notes: "" });
    });

    it("drafts a template with merge fields and the campaign's audience, scoped to the caller's team", async () => {
        const res = await POST(post({ instruction: "shorter" }), ctx);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toMatchObject({ ok: true, subject: "Hi {{firstName|there}}", body: "Body", reviewed: true });
        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "camp-1", teamId: "team-1" } }));
        const [input, teamId] = mockCompose.mock.calls[0];
        expect(teamId).toBe("team-1");
        expect(input.prospect_name).toBe("{{firstName|there}}");
        expect(input.tone).toBe("warm");
        expect(input.sign_off).toBe("Best");
        expect(input.constraints).toContain("The sender asks: shorter");
        expect(input.audience_context).toContain("Target markets: India");
    });

    it("reports an unchecked draft as not reviewed", async () => {
        mockCompose.mockResolvedValue({ subject: "s", body: "b", internal_notes: "", unreviewed: true });
        expect((await (await POST(post({}), ctx)).json()).reviewed).toBe(false);
    });

    it("404s for a campaign outside the team and never calls the model", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);
        const res = await POST(post({}), ctx);
        expect(res.status).toBe(404);
        expect(mockCompose).not.toHaveBeenCalled();
    });

    it("rejects an over-long instruction without calling the model", async () => {
        const res = await POST(post({ instruction: "x".repeat(301) }), ctx);
        expect(res.status).toBe(400);
        expect(mockCompose).not.toHaveBeenCalled();
    });

    it("returns 402 when the team is out of credits", async () => {
        mockCompose.mockRejectedValue(new Error("Insufficient credits"));
        const res = await POST(post({}), ctx);
        expect(res.status).toBe(402);
    });
});
