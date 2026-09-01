import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAdminUser, mockPrisma, mockEnqueue } = vi.hoisted(() => ({
    mockGetAdminUser: vi.fn(),
    mockPrisma: {
        teamMember: { findFirst: vi.fn() },
        campaign: { updateMany: vi.fn() },
    },
    mockEnqueue: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({ getAdminUser: mockGetAdminUser }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { POST } from "./route";

function jsonRequest(body: any) {
    return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) });
}

function params(action: string) {
    return { params: Promise.resolve({ action }) };
}

describe("POST /admin/actions/[action] - cross-tenant scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.campaign.updateMany.mockResolvedValue({ count: 0 });
    });

    it("403s a workspace-level ORG_ADMIN who supplies a teamId they don't belong to", async () => {
        mockGetAdminUser.mockResolvedValue({ id: "user-1", role: "ADMIN", enterpriseRole: "ORG_ADMIN" });
        mockPrisma.teamMember.findFirst.mockResolvedValue(null);

        const res = await POST(jsonRequest({ teamId: "team-victim" }) as any, params("pause-outreach"));

        expect(res.status).toBe(403);
        expect(mockPrisma.campaign.updateMany).not.toHaveBeenCalled();
    });

    it("allows an ORG_ADMIN to act on a team they actually belong to", async () => {
        mockGetAdminUser.mockResolvedValue({ id: "user-1", role: "ADMIN", enterpriseRole: "ORG_ADMIN" });
        mockPrisma.teamMember.findFirst.mockResolvedValue({ teamId: "team-own" });
        mockPrisma.campaign.updateMany.mockResolvedValue({ count: 2 });

        const res = await POST(jsonRequest({ teamId: "team-own" }) as any, params("pause-outreach"));

        expect(res.status).toBe(200);
        expect(mockPrisma.campaign.updateMany).toHaveBeenCalledWith({
            where: { teamId: "team-own", status: "active" },
            data: { status: "paused" },
        });
    });

    it("allows a platform-level SYSTEM_ADMIN to act on an arbitrary teamId without a membership check", async () => {
        mockGetAdminUser.mockResolvedValue({ id: "user-1", role: "ADMIN", enterpriseRole: "SYSTEM_ADMIN" });
        mockPrisma.campaign.updateMany.mockResolvedValue({ count: 5 });

        const res = await POST(jsonRequest({ teamId: "team-any" }) as any, params("pause-outreach"));

        expect(res.status).toBe(200);
        expect(mockPrisma.teamMember.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.campaign.updateMany).toHaveBeenCalledWith({
            where: { teamId: "team-any", status: "active" },
            data: { status: "paused" },
        });
    });

    it("falls back to the admin's own first team when no teamId is supplied", async () => {
        mockGetAdminUser.mockResolvedValue({ id: "user-1", role: "ADMIN", enterpriseRole: "ORG_ADMIN" });
        mockPrisma.teamMember.findFirst.mockResolvedValue({ teamId: "team-own" });
        mockPrisma.campaign.updateMany.mockResolvedValue({ count: 1 });

        const res = await POST(jsonRequest({}) as any, params("pause-outreach"));

        expect(res.status).toBe(200);
        expect(mockPrisma.teamMember.findFirst).toHaveBeenCalledWith({
            where: { userId: "user-1" },
            select: { teamId: true },
        });
        expect(mockPrisma.campaign.updateMany).toHaveBeenCalledWith({
            where: { teamId: "team-own", status: "active" },
            data: { status: "paused" },
        });
    });

    it("401s when there is no admin", async () => {
        mockGetAdminUser.mockResolvedValue(null);

        const res = await POST(jsonRequest({}) as any, params("pause-outreach"));

        expect(res.status).toBe(401);
    });
});
