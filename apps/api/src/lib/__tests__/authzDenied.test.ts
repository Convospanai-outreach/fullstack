import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockWarn, mockFindMember } = vi.hoisted(() => ({ mockWarn: vi.fn(), mockFindMember: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { teamMember: { findFirst: mockFindMember } } }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mockWarn, info: vi.fn(), error: vi.fn() } }));

async function load() {
    vi.resetModules();
    return import("../permissions");
}

describe("denied permission checks are logged", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindMember.mockResolvedValue({ role: "member" });
    });

    it("authorizeRole logs who was refused and what role was required", async () => {
        const { authorizeRole, TeamRole } = await load();

        await expect(authorizeRole("user-1", "team-1", TeamRole.ADMIN)).rejects.toThrow("Insufficient permissions");

        expect(mockWarn).toHaveBeenCalledWith("authz.denied", {
            userId: "user-1",
            teamId: "team-1",
            required: "role:admin",
        });
    });

    it("authorizePermission logs the permission that was required", async () => {
        const { authorizePermission, Permission } = await load();

        await expect(authorizePermission("user-1", "team-1", Permission.MANAGE_SSO)).rejects.toThrow();

        expect(mockWarn).toHaveBeenCalledWith("authz.denied", {
            userId: "user-1",
            teamId: "team-1",
            required: "permission:manage_sso",
        });
    });

    it("forbiddenUnlessRole logs the refusal it turns into a 403", async () => {
        const { forbiddenUnlessRole, TeamRole } = await load();

        const response = await forbiddenUnlessRole("user-1", "team-1", TeamRole.OWNER);

        expect(response?.status).toBe(403);
        expect(mockWarn).toHaveBeenCalledWith("authz.denied", expect.objectContaining({ required: "role:owner" }));
    });

    it("logs nothing when access is granted", async () => {
        mockFindMember.mockResolvedValue({ role: "owner" });
        const { authorizeRole, forbiddenUnlessRole, TeamRole } = await load();

        await authorizeRole("user-1", "team-1", TeamRole.ADMIN);
        await forbiddenUnlessRole("user-1", "team-1", TeamRole.ADMIN);

        expect(mockWarn).not.toHaveBeenCalled();
    });

    it("logs a repeated refusal of the same user once a minute, not once per request", async () => {
        const { authorizeRole, TeamRole } = await load();

        for (let i = 0; i < 25; i++) await authorizeRole("user-1", "team-1", TeamRole.ADMIN).catch(() => undefined);
        await authorizeRole("user-2", "team-1", TeamRole.ADMIN).catch(() => undefined);

        expect(mockWarn).toHaveBeenCalledTimes(2);
    });
});
