import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockIngestUrl, mockIngestDocument } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        knowledgeBase: { findFirst: vi.fn(), deleteMany: vi.fn() },
        knowledgeItem: { findMany: vi.fn() },
    },
    mockIngestUrl: vi.fn(),
    mockIngestDocument: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/rag/service/ingest", () => ({
    ingestService: { ingestUrl: mockIngestUrl, ingestDocument: mockIngestDocument },
}));

import { GET, DELETE } from "./route";

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("knowledge/[id] - cross-tenant scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-a" });
    });

    describe("GET", () => {
        it("404s and never lists items when the knowledge base belongs to another team", async () => {
            mockPrisma.knowledgeBase.findFirst.mockResolvedValue(null);

            const res = await GET(new Request("http://localhost") as any, paramsFor("kb-from-team-b"));

            expect(res.status).toBe(404);
            expect(mockPrisma.knowledgeItem.findMany).not.toHaveBeenCalled();
        });

        it("lists items when the knowledge base belongs to the requesting team", async () => {
            mockPrisma.knowledgeBase.findFirst.mockResolvedValue({ id: "kb-1", teamId: "team-a" });
            mockPrisma.knowledgeItem.findMany.mockResolvedValue([{ id: "item-1" }]);

            const res = await GET(new Request("http://localhost") as any, paramsFor("kb-1"));

            expect(res.status).toBe(200);
            expect(mockPrisma.knowledgeItem.findMany).toHaveBeenCalledWith({
                where: { knowledgeBaseId: "kb-1" },
                orderBy: { createdAt: "desc" },
            });
        });
    });

    describe("DELETE", () => {
        it("scopes the actual delete mutation by teamId, not just a pre-check", async () => {
            mockPrisma.knowledgeBase.deleteMany.mockResolvedValue({ count: 1 });

            const res = await DELETE(new Request("http://localhost") as any, paramsFor("kb-1"));

            expect(res.status).toBe(200);
            expect(mockPrisma.knowledgeBase.deleteMany).toHaveBeenCalledWith({
                where: { id: "kb-1", teamId: "team-a" },
            });
        });

        it("403s instead of deleting a knowledge base that belongs to another team", async () => {
            mockPrisma.knowledgeBase.deleteMany.mockResolvedValue({ count: 0 });

            const res = await DELETE(new Request("http://localhost") as any, paramsFor("kb-from-team-b"));

            expect(res.status).toBe(403);
        });
    });
});
