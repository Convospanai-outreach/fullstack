import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSuperAdminUserId, prisma, resolveEnabledFeatureKeys, getCurrentContext, checkTeamPermission, cookieSet } = vi.hoisted(() => ({
    getSuperAdminUserId: vi.fn(),
    prisma: {
        user: { findUnique: vi.fn() },
        superAdminAuditLog: { create: vi.fn() },
        featureFlag: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
        team: { findUnique: vi.fn(), update: vi.fn() },
        $executeRaw: vi.fn(),
        organizationPolicy: { findUnique: vi.fn(), upsert: vi.fn() },
    },
    resolveEnabledFeatureKeys: vi.fn(),
    getCurrentContext: vi.fn(),
    checkTeamPermission: vi.fn(),
    cookieSet: vi.fn(),
}));

vi.mock("@/lib/superadmin/session", () => ({ getSuperAdminUserId }));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/hiddenFeaturesReadiness", () => ({ resolveEnabledFeatureKeys, loadFeatureContext: vi.fn(), resolveEnabledFeatureKeysFromContext: vi.fn(), resolveReadiness: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContext }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission, TeamRole: { ADMIN: "admin" } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet, get: () => undefined }) }));

import * as featuresRoute from "../../src/app/api/superadmin/features/route";
import * as teamRoute from "../../src/app/api/superadmin/teams/[id]/route";
import * as settingsRoute from "../../src/app/api/settings/hidden-features/route";

const json = (method: string, body: unknown) =>
    new Request("http://localhost/x", { method, body: JSON.stringify(body), headers: { "x-forwarded-for": "203.0.113.5" } }) as any;
const teamParams = { params: Promise.resolve({ id: "team-1" }) };

describe("superadmin feature control", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSuperAdminUserId.mockResolvedValue("sa-1");
        prisma.user.findUnique.mockResolvedValue({ id: "sa-1", email: "ops@example.com", enterpriseRole: "SYSTEM_ADMIN", superAdminCredential: { id: "c" } });
        prisma.featureFlag.findMany.mockResolvedValue([]);
        prisma.team.findUnique.mockResolvedValue({ id: "team-1", name: "Acme", enabledFeatures: ["whatsapp"] });
        prisma.organizationPolicy.findUnique.mockResolvedValue(null);
        resolveEnabledFeatureKeys.mockResolvedValue(new Set(["whatsapp"]));
    });

    it("needs a superadmin session", async () => {
        getSuperAdminUserId.mockResolvedValue(null);
        expect((await featuresRoute.POST(json("POST", { key: "whatsapp", disabled: true }))).status).toBe(401);
        expect((await teamRoute.PUT(json("PUT", { enabledFeatures: [] }), teamParams)).status).toBe(401);
        expect(prisma.featureFlag.upsert).not.toHaveBeenCalled();
        expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it("switches an optional feature off and back on for every team", async () => {
        await featuresRoute.POST(json("POST", { key: "whatsapp", disabled: true }));
        expect(prisma.featureFlag.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: "hidden_feature:whatsapp" }, update: { isEnabled: false } }));
        expect(prisma.superAdminAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "FEATURE_PLATFORM_OFF" }) }));

        await featuresRoute.POST(json("POST", { key: "whatsapp", disabled: false }));
        expect(prisma.featureFlag.deleteMany).toHaveBeenCalledWith({ where: { key: "hidden_feature:whatsapp" } });

        expect((await featuresRoute.POST(json("POST", { key: "not-a-feature", disabled: true }))).status).toBe(400);
    });

    it("sets a team's features, resets them to automatic, and audits the change", async () => {
        expect((await teamRoute.PUT(json("PUT", { enabledFeatures: ["workflows", "workflows"] }), teamParams)).status).toBe(200);
        expect(prisma.team.update).toHaveBeenCalledWith({ where: { id: "team-1" }, data: { enabledFeatures: ["workflows"] } });
        expect(prisma.superAdminAuditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ action: "TEAM_FEATURES_SET", metadata: { teamId: "team-1", before: ["whatsapp"], after: ["workflows"] } }) })
        );

        await teamRoute.PUT(json("PUT", { enabledFeatures: null }), teamParams);
        expect(prisma.team.update).toHaveBeenCalledTimes(1);
        const [sql, teamIdParam] = prisma.$executeRaw.mock.calls[0]!;
        expect(sql.join("?")).toContain('SET "enabledFeatures" = NULL');
        expect(teamIdParam).toBe("team-1");

        expect((await teamRoute.PUT(json("PUT", { enabledFeatures: ["bogus"] }), teamParams)).status).toBe(400);
    });

    it("validates and writes the team policy", async () => {
        expect((await teamRoute.PUT(json("PUT", { policy: { productMode: "EVERYTHING" } }), teamParams)).status).toBe(400);
        expect((await teamRoute.PUT(json("PUT", { policy: { maxCampaigns: -1 } }), teamParams)).status).toBe(400);
        expect((await teamRoute.PUT(json("PUT", { policy: { allowScraping: "yes" } }), teamParams)).status).toBe(400);
        expect(prisma.organizationPolicy.upsert).not.toHaveBeenCalled();

        await teamRoute.PUT(json("PUT", { policy: { productMode: "ALL_FEATURES", maxCampaigns: 25, allowScraping: true } }), teamParams);
        expect(prisma.organizationPolicy.upsert).toHaveBeenCalledWith({
            where: { organizationId: "team-1" },
            create: { organizationId: "team-1", productMode: "ALL_FEATURES", maxCampaigns: 25, allowScraping: true },
            update: { productMode: "ALL_FEATURES", maxCampaigns: 25, allowScraping: true },
        });
    });

    it("returns 404 for an unknown team", async () => {
        prisma.team.findUnique.mockResolvedValue(null);
        expect((await teamRoute.GET(json("GET", undefined), teamParams)).status).toBe(404);
    });
});

describe("team-side feature settings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentContext.mockResolvedValue({ userId: "u-1", teamId: "team-1" });
        prisma.featureFlag.findMany.mockResolvedValue([{ key: "hidden_feature:whatsapp" }]);
        prisma.team.findUnique.mockResolvedValue({ enabledFeatures: ["whatsapp"] });
    });

    it("only team owners and admins can change features", async () => {
        checkTeamPermission.mockResolvedValue(false);
        const res = await settingsRoute.PUT(json("PUT", { enabledFeatures: ["workflows"] }));
        expect(res.status).toBe(403);
        expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it("keeps the team's choice for a platform-disabled feature but leaves it out of the cookie", async () => {
        checkTeamPermission.mockResolvedValue(true);
        const res = await settingsRoute.PUT(json("PUT", { enabledFeatures: ["workflows"] }));
        expect(res.status).toBe(200);
        expect(prisma.team.update).toHaveBeenCalledWith({ where: { id: "team-1" }, data: { enabledFeatures: ["workflows", "whatsapp"] } });
        expect(cookieSet).toHaveBeenCalledWith(expect.objectContaining({ value: "workflows" }));
    });
});
