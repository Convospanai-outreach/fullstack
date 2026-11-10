import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The notice version, shared with apps/web (tests/fixtures/data-responsibility.json).
const NOTICE_VERSION = (JSON.parse(readFileSync(resolve(__dirname, "../../../../web/tests/fixtures/data-responsibility.json"), "utf8")) as { version: string }).version;

const { mockCheckTeamPermission, mockGetCurrentContextFromRequest, mockPrisma, mockIcpCreate } = vi.hoisted(() => ({
    mockCheckTeamPermission: vi.fn(),
    mockGetCurrentContextFromRequest: vi.fn(),
    mockPrisma: {
        team: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        iCP: { findFirst: vi.fn() },
    },
    mockIcpCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    getCurrentContextFromRequest: mockGetCurrentContextFromRequest,
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/modules/icp-builder/service/icpService", () => ({ icpService: { create: mockIcpCreate } }));

vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin", MEMBER: "member" },
    checkTeamPermission: mockCheckTeamPermission,
}));

function postRequest(body: unknown) {
    return new Request("http://localhost/setup/save", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("/setup/save", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContextFromRequest.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.team.findUnique.mockResolvedValue({ branding: {}, aiConfig: {} });
        mockPrisma.team.update.mockResolvedValue({});
    });

    it("lets a plain team member (not admin/owner) save a setup step", async () => {
        // An invited teammate who isn't ORG_ADMIN lands on team role "member" (see
        // googleOnboarding.ts) - this must not 403 them out of the setup wizard's Save button.
        mockCheckTeamPermission.mockImplementation(async (_userId, _teamId, role) => role === "member");
        const { POST } = await import("./route");

        const response = await POST(postRequest({ step: 2, data: { companyName: "Acme" } }));

        expect(response.status).toBe(200);
        expect(mockCheckTeamPermission).toHaveBeenCalledWith("user-1", "team-1", "member");
        expect(mockPrisma.team.update).toHaveBeenCalled();
    });

    describe("website scan (step 15)", () => {
        const profile = { company_name: "Acme", icp_primary: { industry: "Retail", buyer_title: "Head of HR", pain_statement: "Slow hiring" }, campaign_seed: { signal_keywords: ["payroll"] } };
        beforeEach(() => {
            mockCheckTeamPermission.mockResolvedValue(true);
            mockPrisma.team.findUnique.mockResolvedValue({ branding: {}, aiConfig: { tone: "warm" } });
            mockPrisma.iCP.findFirst.mockResolvedValue(null);
        });

        it("saves the reviewed profile into aiConfig, keeping other settings, and creates no ICP unless asked", async () => {
            const { POST } = await import("./route");
            const response = await POST(postRequest({ step: 15, data: { companyProfile: profile, sourceUrl: "https://acme.test" } }));

            expect(response.status).toBe(200);
            const saved = mockPrisma.team.update.mock.calls[0][0].data.aiConfig;
            expect(saved.tone).toBe("warm");
            expect(saved.companyProfile).toMatchObject({ company_name: "Acme", sourceUrl: "https://acme.test" });
            expect(saved.companyProfile.confirmedAt).toEqual(expect.any(String));
            expect(mockIcpCreate).not.toHaveBeenCalled();
        });

        it("creates one ICP from the confirmed profile when asked, and not a second time", async () => {
            const { POST } = await import("./route");
            await POST(postRequest({ step: 15, data: { companyProfile: profile, createIcp: true } }));
            expect(mockIcpCreate).toHaveBeenCalledWith("team-1", expect.objectContaining({
                name: "Acme (from website)",
                criteria: expect.objectContaining({ buyerTitles: ["Head of HR"], signalKeywords: ["payroll"] }),
            }));

            mockIcpCreate.mockClear();
            mockPrisma.iCP.findFirst.mockResolvedValue({ id: "icp-1" });
            await POST(postRequest({ step: 15, data: { companyProfile: profile, createIcp: true } }));
            expect(mockIcpCreate).not.toHaveBeenCalled();
        });

        it("rejects a profile that is not the expected shape", async () => {
            const { POST } = await import("./route");
            const response = await POST(postRequest({ step: 15, data: { companyProfile: { company_name: "x".repeat(5000) } } }));
            expect(response.status).toBe(400);
            expect(mockPrisma.team.update).not.toHaveBeenCalled();
        });
    });

    it("saves the outreach mode (step 1) into aiConfig, keeping the other settings", async () => {
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.team.findUnique.mockResolvedValue({ branding: {}, aiConfig: { tone: "Friendly" } });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ step: 1, data: { outreachMode: "personal", acknowledgedDataResponsibility: true } }));

        expect(response.status).toBe(200);
        expect(mockPrisma.team.update).toHaveBeenCalledWith({
            where: { id: "team-1" },
            data: { aiConfig: { tone: "Friendly", outreachMode: "personal", dataResponsibility: expect.objectContaining({ version: NOTICE_VERSION }) } },
        });
    });

    it("needs the data responsibility acknowledgement to save the launch brief (step 1)", async () => {
        mockCheckTeamPermission.mockResolvedValue(true);
        const { POST } = await import("./route");

        const response = await POST(postRequest({ step: 1, data: { outreachMode: "company", acknowledgedDataResponsibility: false } }));

        expect(response.status).toBe(400);
        expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });

    it("stores who acknowledged the notice, when, and which version, keeping the other settings", async () => {
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.team.findUnique.mockResolvedValue({ branding: {}, aiConfig: { tone: "Friendly" } });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ step: 1, data: { outreachMode: "company", acknowledgedDataResponsibility: true } }));

        expect(response.status).toBe(200);
        expect(mockPrisma.team.update).toHaveBeenCalledWith({
            where: { id: "team-1" },
            data: {
                aiConfig: {
                    tone: "Friendly",
                    outreachMode: "company",
                    dataResponsibility: { version: NOTICE_VERSION, acknowledgedBy: "user-1", acknowledgedAt: expect.any(String) },
                },
            },
        });
    });

    it("rejects an outreach mode other than personal or company", async () => {
        mockCheckTeamPermission.mockResolvedValue(true);
        const { POST } = await import("./route");

        const response = await POST(postRequest({ step: 1, data: { outreachMode: "agency" } }));

        expect(response.status).toBe(400);
        expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });

    it("keeps the AI provider key (step 6) for admins", async () => {
        mockCheckTeamPermission.mockImplementation(async (_userId, _teamId, role) => role === "member");
        const { POST } = await import("./route");

        const response = await POST(postRequest({ step: 6, data: { geminiKey: "AIza-test" } }));

        expect(response.status).toBe(403);
        expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });

    it("lets an admin save the AI provider key (step 6)", async () => {
        mockCheckTeamPermission.mockResolvedValue(true);
        const { POST } = await import("./route");

        const response = await POST(postRequest({ step: 6, data: { geminiKey: "AIza-test" } }));

        expect(response.status).toBe(200);
        expect(mockPrisma.team.update).toHaveBeenCalledTimes(1);
    });

    it("still blocks a user with no team membership at all", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);
        const { POST } = await import("./route");

        const response = await POST(postRequest({ step: 2, data: { companyName: "Acme" } }));

        expect(response.status).toBe(403);
        expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });
});
