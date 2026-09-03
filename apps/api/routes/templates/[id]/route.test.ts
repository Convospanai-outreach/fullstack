import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        emailTemplate: { findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { PUT, DELETE } from "./route";

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

function jsonRequest(body: any) {
    return new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) });
}

describe("templates/[id] - cross-tenant scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-a" });
    });

    describe("PUT", () => {
        const validBody = { name: "New Name", subject: "Subj", body: "Body" };

        it("404s and never updates a template that belongs to another team", async () => {
            mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

            const res = await PUT(jsonRequest(validBody) as any, paramsFor("template-from-team-b"));

            expect(res.status).toBe(404);
            expect(mockPrisma.emailTemplate.updateMany).not.toHaveBeenCalled();
        });

        it("scopes the actual update mutation by teamId, not just the pre-check", async () => {
            mockPrisma.emailTemplate.findUnique
                .mockResolvedValueOnce({ id: "template-1", teamId: "team-a" })
                .mockResolvedValueOnce({ id: "template-1", teamId: "team-a", ...validBody });
            mockPrisma.emailTemplate.updateMany.mockResolvedValue({ count: 1 });

            const res = await PUT(jsonRequest(validBody) as any, paramsFor("template-1"));

            expect(res.status).toBe(200);
            expect(mockPrisma.emailTemplate.updateMany).toHaveBeenCalledWith({
                where: { id: "template-1", teamId: "team-a" },
                data: validBody,
            });
        });
    });

    describe("DELETE", () => {
        it("404s and never deletes a template that belongs to another team", async () => {
            mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

            const res = await DELETE(new Request("http://localhost") as any, paramsFor("template-from-team-b"));

            expect(res.status).toBe(404);
            expect(mockPrisma.emailTemplate.deleteMany).not.toHaveBeenCalled();
        });

        it("scopes the actual delete mutation by teamId, not just the pre-check", async () => {
            mockPrisma.emailTemplate.findUnique.mockResolvedValue({ id: "template-1", teamId: "team-a" });
            mockPrisma.emailTemplate.deleteMany.mockResolvedValue({ count: 1 });

            const res = await DELETE(new Request("http://localhost") as any, paramsFor("template-1"));

            expect(res.status).toBe(200);
            expect(mockPrisma.emailTemplate.deleteMany).toHaveBeenCalledWith({
                where: { id: "template-1", teamId: "team-a" },
            });
        });
    });
});
