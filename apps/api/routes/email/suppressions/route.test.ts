import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetContext, mockCheckTeamPermission, mockPrisma, mockAudit } = vi.hoisted(() => ({
    mockGetContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockPrisma: {
        suppressionEntry: { findFirst: vi.fn(), deleteMany: vi.fn() },
    },
    mockAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));
vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({ recordSuppression: vi.fn() }));

import { DELETE } from "./route";

const del = (query = "?id=sup-1") =>
    DELETE(new NextRequest(`http://localhost:3001/email/suppressions${query}`, { method: "DELETE" }));

describe("DELETE /email/suppressions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.suppressionEntry.findFirst.mockResolvedValue({ id: "sup-1", email: "lead@example.test", reason: "UNSUBSCRIBE", source: "INBOX" });
        mockPrisma.suppressionEntry.deleteMany.mockResolvedValue({ count: 1 });
    });

    it("rejects an unauthenticated caller", async () => {
        mockGetContext.mockResolvedValue({ userId: null, teamId: null });

        expect((await del()).status).toBe(401);
        expect(mockPrisma.suppressionEntry.deleteMany).not.toHaveBeenCalled();
    });

    it("rejects a non-admin and removes nothing", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        expect((await del()).status).toBe(403);
        expect(mockCheckTeamPermission).toHaveBeenCalledWith("user-1", "team-a", "ADMIN");
        expect(mockPrisma.suppressionEntry.deleteMany).not.toHaveBeenCalled();
    });

    it("requires an id", async () => {
        expect((await del("")).status).toBe(400);
    });

    it("404s for another team's entry and removes nothing", async () => {
        mockPrisma.suppressionEntry.findFirst.mockResolvedValue(null);

        expect((await del("?id=sup-team-b")).status).toBe(404);
        expect(mockPrisma.suppressionEntry.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "sup-team-b", teamId: "team-a" } }));
        expect(mockPrisma.suppressionEntry.deleteMany).not.toHaveBeenCalled();
        expect(mockAudit).not.toHaveBeenCalled();
    });

    it("removes the team's entry and audit-logs who removed which address", async () => {
        const response = await del();

        expect(response.status).toBe(200);
        expect(mockPrisma.suppressionEntry.deleteMany).toHaveBeenCalledWith({ where: { id: "sup-1", teamId: "team-a" } });
        expect(mockAudit).toHaveBeenCalledWith({
            actorId: "user-1",
            orgId: "team-a",
            action: "REMOVE_SUPPRESSION",
            entity: "SuppressionEntry",
            entityId: "sup-1",
            metadata: { email: "lead@example.test", reason: "UNSUBSCRIBE", source: "INBOX" },
        });
    });
});
