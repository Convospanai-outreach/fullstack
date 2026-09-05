import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockAuth, mockInboxService } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findUnique: vi.fn() },
        message: { findMany: vi.fn() },
    },
    mockAuth: {
        getCurrentContext: vi.fn(),
    },
    mockInboxService: {
        markAsRead: vi.fn(),
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockAuth.getCurrentContext }));
vi.mock("@/lib/inboxService", () => ({ InboxService: mockInboxService }));

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("GET /api/inbox/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 if unauthenticated", async () => {
        mockAuth.getCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { GET } = await import("./route");

        const res = await GET(new Request("http://localhost/api/inbox/lead-1"), paramsFor("lead-1"));

        expect(res.status).toBe(401);
        expect(mockInboxService.markAsRead).not.toHaveBeenCalled();
    });

    it("never marks another team's messages as read (404 before any write)", async () => {
        mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
        mockPrisma.lead.findUnique.mockResolvedValue(null);
        const { GET } = await import("./route");

        const res = await GET(new Request("http://localhost/api/inbox/lead-foreign"), paramsFor("lead-foreign"));

        expect(res.status).toBe(404);
        expect(mockInboxService.markAsRead).not.toHaveBeenCalled();
        expect(mockPrisma.message.findMany).not.toHaveBeenCalled();
    });

    it("marks messages as read only after confirming the lead belongs to the caller's team", async () => {
        mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
        mockPrisma.lead.findUnique.mockResolvedValue({ fullName: "Lead One", company: null, linkedIn: null, jobTitle: null });
        mockPrisma.message.findMany.mockResolvedValue([]);
        const { GET } = await import("./route");

        const res = await GET(new Request("http://localhost/api/inbox/lead-1"), paramsFor("lead-1"));

        expect(res.status).toBe(200);
        expect(mockPrisma.lead.findUnique).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-alpha" },
            select: { fullName: true, company: true, linkedIn: true, jobTitle: true },
        });
        expect(mockInboxService.markAsRead).toHaveBeenCalledWith("lead-1");
    });
});
