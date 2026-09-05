import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

const { mockGetAdminUser, mockPrisma, mockAudit } = vi.hoisted(() => ({
    mockGetAdminUser: vi.fn(),
    mockPrisma: {
        user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        teamMember: { findFirst: vi.fn() },
    },
    mockAudit: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({ getAdminUser: mockGetAdminUser }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));

import { GET, POST, PATCH } from "./route";

function jsonRequest(body: any) {
    return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
}

describe("admin/users route - platform-admin scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("GET", () => {
        it("403s an ORG_ADMIN and never lists users", async () => {
            mockGetAdminUser.mockResolvedValue(null);

            const res = await GET();

            expect(res.status).toBe(403);
            expect(mockGetAdminUser).toHaveBeenCalledWith(UserRole.SYSTEM_ADMIN);
            expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
        });

        it("allows a SYSTEM_ADMIN to list all users", async () => {
            mockGetAdminUser.mockResolvedValue({ id: "admin-1", enterpriseRole: "SYSTEM_ADMIN" });
            mockPrisma.user.findMany.mockResolvedValue([{ id: "u1" }]);

            const res = await GET();

            expect(res.status).toBe(200);
            expect(mockPrisma.user.findMany).toHaveBeenCalled();
        });
    });

    describe("POST", () => {
        it("403s an ORG_ADMIN and never creates a user", async () => {
            mockGetAdminUser.mockResolvedValue(null);

            const res = await POST(jsonRequest({ email: "a@b.com" }) as any);

            expect(res.status).toBe(403);
            expect(mockPrisma.user.create).not.toHaveBeenCalled();
        });

        it("allows a SYSTEM_ADMIN to create a user", async () => {
            mockGetAdminUser.mockResolvedValue({ id: "admin-1", enterpriseRole: "SYSTEM_ADMIN" });
            mockPrisma.user.findUnique.mockResolvedValue(null);
            mockPrisma.user.create.mockResolvedValue({ id: "u2", email: "a@b.com" });
            mockPrisma.teamMember.findFirst.mockResolvedValue(null);

            const res = await POST(jsonRequest({ email: "a@b.com" }) as any);

            expect(res.status).toBe(200);
            expect(mockPrisma.user.create).toHaveBeenCalled();
        });
    });

    describe("PATCH", () => {
        it("403s an ORG_ADMIN and never updates a user's role", async () => {
            mockGetAdminUser.mockResolvedValue(null);

            const res = await PATCH(jsonRequest({ id: "u1", enterpriseRole: "ORG_ADMIN" }) as any);

            expect(res.status).toBe(403);
            expect(mockPrisma.user.update).not.toHaveBeenCalled();
        });

        it("allows a SYSTEM_ADMIN to update a user's role", async () => {
            mockGetAdminUser.mockResolvedValue({ id: "admin-1", enterpriseRole: "SYSTEM_ADMIN" });
            mockPrisma.user.update.mockResolvedValue({ id: "u1", enterpriseRole: "ORG_ADMIN" });
            mockPrisma.teamMember.findFirst.mockResolvedValue(null);

            const res = await PATCH(jsonRequest({ id: "u1", enterpriseRole: "ORG_ADMIN" }) as any);

            expect(res.status).toBe(200);
            expect(mockPrisma.user.update).toHaveBeenCalledWith({
                where: { id: "u1" },
                data: { enterpriseRole: "ORG_ADMIN" },
            });
        });
    });
});
