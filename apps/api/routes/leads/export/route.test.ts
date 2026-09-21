import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizeRole, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockPrisma: {
        lead: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/permissions")>();
    return { ...actual, authorizeRole: mockAuthorizeRole };
});

function lead(id: string, over: Record<string, unknown> = {}) {
    return {
        id,
        fullName: "Jane",
        company: "Acme",
        jobTitle: "VP",
        location: "NYC",
        email: "j@a.com",
        linkedIn: "in/jane",
        status: "NEW",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        ...over,
    };
}

describe("GET /api/leads/export", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects an unauthenticated caller instead of dumping every lead in the database", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { GET } = await import("./route");

        const response = await GET();

        expect(response.status).toBe(401);
        expect(mockPrisma.lead.findMany).not.toHaveBeenCalled();
    });

    it("propagates the 403 from a caller lacking MEMBER role instead of exporting", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        const { APIError } = await import("@/lib/apiResponse");
        mockAuthorizeRole.mockRejectedValue(new APIError("Insufficient permissions", 403));
        const { GET } = await import("./route");

        const response = await GET();

        expect(response.status).toBe(403);
        expect(mockPrisma.lead.findMany).not.toHaveBeenCalled();
    });

    it("streams a bounded, team-scoped CSV (marker header + take, not an unbounded findMany)", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.lead.findMany.mockResolvedValue([lead("l1"), lead("l2", { email: "b@a.com" })]);
        const { GET } = await import("./route");

        const response = await GET();
        const text = await response.text(); // drain the stream

        expect(response.headers.get("x-stream-body")).toBe("1");
        expect(response.headers.get("content-type")).toContain("text/csv");

        // The query is bounded (take) and scoped to the team, not a bare findMany.
        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teamId: "team-1" },
                take: 1000,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            })
        );
        // First page carries no cursor.
        expect(mockPrisma.lead.findMany.mock.calls[0][0].cursor).toBeUndefined();

        const lines = text.split("\n");
        expect(lines[0]).toBe("ID,Full Name,Company,Job Title,Location,Email,LinkedIn,Status,Created At");
        expect(lines).toHaveLength(3);
        expect(lines[1]).toContain('"l1"');
        expect(lines[1]).toContain('"j@a.com"');
        expect(lines[2]).toContain('"b@a.com"');
    });

    it("surfaces a mid-stream DB failure instead of finishing with a silent, truncated 200 body", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.lead.findMany.mockRejectedValue(new Error("db exploded mid-export"));
        const { GET } = await import("./route");

        const response = await GET();
        // Headers/200 are already sent, so the failure shows up as the stream
        // erroring while the client reads it - not as a clean, complete file.
        await expect(response.text()).rejects.toThrow("db exploded mid-export");
    });

    it("continues to the next page with a cursor when a full batch comes back", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        const fullBatch = Array.from({ length: 1000 }, (_, i) => lead(`l${i}`));
        mockPrisma.lead.findMany.mockResolvedValueOnce(fullBatch).mockResolvedValueOnce([]);
        const { GET } = await import("./route");

        const response = await GET();
        await response.text(); // drain

        expect(mockPrisma.lead.findMany).toHaveBeenCalledTimes(2);
        expect(mockPrisma.lead.findMany.mock.calls[1][0]).toMatchObject({
            cursor: { id: "l999" },
            skip: 1,
        });
    });
});
