import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockAddDocument, mockSearch } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        knowledgeBase: { findFirst: vi.fn() },
    },
    mockAddDocument: vi.fn(),
    mockSearch: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/knowledge/knowledgeService", () => ({
    knowledgeService: { addDocument: mockAddDocument, search: mockSearch },
}));

import { GET, POST } from "./route";

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("knowledge/[id]/upload - cross-tenant scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-a" });
    });

    describe("POST", () => {
        it("404s and never adds a document when the knowledge base belongs to another team", async () => {
            mockPrisma.knowledgeBase.findFirst.mockResolvedValue(null);

            const req = new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ content: "hijacked content" }),
            });
            const res = await POST(req as any, paramsFor("kb-from-team-b"));

            expect(res.status).toBe(404);
            expect(mockPrisma.knowledgeBase.findFirst).toHaveBeenCalledWith({
                where: { id: "kb-from-team-b", teamId: "team-a" },
            });
            expect(mockAddDocument).not.toHaveBeenCalled();
        });

        it("adds a document when the knowledge base belongs to the requesting team", async () => {
            mockPrisma.knowledgeBase.findFirst.mockResolvedValue({ id: "kb-1", teamId: "team-a" });
            mockAddDocument.mockResolvedValue({ id: "item-1" });

            const req = new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ content: "real content" }),
            });
            const res = await POST(req as any, paramsFor("kb-1"));

            expect(res.status).toBe(200);
            expect(mockAddDocument).toHaveBeenCalledWith("kb-1", "real content", undefined);
        });
    });

    describe("GET", () => {
        it("requires authentication (previously had no auth check at all)", async () => {
            mockGetCurrentContext.mockResolvedValue({ teamId: null });

            const req = new Request("http://localhost?q=test");
            const res = await GET(req as any, paramsFor("kb-1"));

            expect(res.status).toBe(401);
            expect(mockSearch).not.toHaveBeenCalled();
        });

        it("404s and never searches when the knowledge base belongs to another team", async () => {
            mockPrisma.knowledgeBase.findFirst.mockResolvedValue(null);

            const req = new Request("http://localhost?q=test");
            const res = await GET(req as any, paramsFor("kb-from-team-b"));

            expect(res.status).toBe(404);
            expect(mockSearch).not.toHaveBeenCalled();
        });

        it("searches when the knowledge base belongs to the requesting team", async () => {
            mockPrisma.knowledgeBase.findFirst.mockResolvedValue({ id: "kb-1", teamId: "team-a" });
            mockSearch.mockResolvedValue([{ id: "item-1", content: "match", score: 1, metadata: {} }]);

            const req = new Request("http://localhost?q=test");
            const res = await GET(req as any, paramsFor("kb-1"));

            expect(res.status).toBe(200);
            expect(mockSearch).toHaveBeenCalledWith("kb-1", "test");
        });
    });
});
