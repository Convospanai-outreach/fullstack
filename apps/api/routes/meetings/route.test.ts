import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        meeting: { findMany: vi.fn(), create: vi.fn() },
        lead: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

function postRequest(body: unknown) {
    return new Request("http://localhost/meetings", { method: "POST", body: JSON.stringify(body) });
}

function validBody(overrides: Record<string, unknown> = {}) {
    return {
        title: "Intro call",
        startTime: "2026-01-01T10:00:00.000Z",
        endTime: "2026-01-01T10:30:00.000Z",
        ...overrides,
    };
}

describe("POST /meetings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("rejects a leadId belonging to another team", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        const { POST } = await import("./route");

        const response = await POST(postRequest(validBody({ leadId: "other-teams-lead" })) as any);

        expect(response.status).toBe(404);
        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
            where: { id: "other-teams-lead", teamId: "team-1" },
            select: { id: true },
        });
        expect(mockPrisma.meeting.create).not.toHaveBeenCalled();
    });

    it("creates a meeting for a leadId belonging to the caller's own team", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "own-lead" });
        mockPrisma.meeting.create.mockResolvedValue({ id: "meeting-1" });
        const { POST } = await import("./route");

        const response = await POST(postRequest(validBody({ leadId: "own-lead" })) as any);

        expect(response.status).toBe(200);
        expect(mockPrisma.meeting.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ leadId: "own-lead", teamId: "team-1" }) })
        );
    });

    it("creates a meeting with no leadId without checking lead ownership", async () => {
        mockPrisma.meeting.create.mockResolvedValue({ id: "meeting-1" });
        const { POST } = await import("./route");

        const response = await POST(postRequest(validBody()) as any);

        expect(response.status).toBe(200);
        expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
    });
});
