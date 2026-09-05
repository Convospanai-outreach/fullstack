import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        team: { findUnique: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

function postRequest(body: unknown) {
    return new Request("http://localhost/api/studio/config", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /api/studio/config - merges into the shared aiConfig blob", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("preserves smtpConfig and apiKey already stored in aiConfig instead of overwriting them", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: {
                smtpConfig: { host: "smtp.gmail.com", user: "team@example.com" },
                apiKey: "existing-gemini-key",
                tone: "Professional",
            },
        });
        mockPrisma.team.update.mockResolvedValue({});
        const { POST } = await import("./route");

        const response = await POST(postRequest({
            formality: "casual",
            directness: "high",
            talkingPoints: ["point a"],
            avoidWords: ["spam"],
        }));

        expect(response.status).toBe(200);
        expect(mockPrisma.team.update).toHaveBeenCalledWith({
            where: { id: "team-1" },
            data: {
                aiConfig: {
                    smtpConfig: { host: "smtp.gmail.com", user: "team@example.com" },
                    apiKey: "existing-gemini-key",
                    tone: "Professional",
                    formality: "casual",
                    directness: "high",
                    talkingPoints: ["point a"],
                    avoidWords: ["spam"],
                },
            },
        });
    });

    it("strips a caller-supplied smtpConfig/apiKey from the body instead of writing it through", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({
            aiConfig: {
                smtpConfig: { host: "smtp.gmail.com", user: "team@example.com" },
                apiKey: "existing-gemini-key",
            },
        });
        mockPrisma.team.update.mockResolvedValue({});
        const { POST } = await import("./route");

        const response = await POST(postRequest({
            formality: "casual",
            smtpConfig: { host: "smtp.attacker.example", user: "attacker@evil.com", password: "hijacked" },
            apiKey: "attacker-key",
        }));

        expect(response.status).toBe(200);
        expect(mockPrisma.team.update).toHaveBeenCalledWith({
            where: { id: "team-1" },
            data: {
                aiConfig: {
                    smtpConfig: { host: "smtp.gmail.com", user: "team@example.com" },
                    apiKey: "existing-gemini-key",
                    formality: "casual",
                },
            },
        });
    });

    it("rejects with no session", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { POST } = await import("./route");

        const response = await POST(postRequest({ formality: "casual" }));

        expect(response.status).toBe(401);
        expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });
});
