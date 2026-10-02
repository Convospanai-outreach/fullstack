import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentContext: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: vi.fn(), TeamRole: { ADMIN: "admin" } }));
vi.mock("@/lib/hiddenFeaturesReadiness", () => ({ resolveEnabledFeatureKeys: vi.fn() }));
vi.mock("@/modules/facebook-leads/service/facebookLeadsService", () => ({ buildFacebookLeadsAuthUrl: vi.fn(() => "https://facebook.test/dialog") }));

import { GET } from "./route";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission } from "@/lib/permissions";
import { resolveEnabledFeatureKeys } from "@/lib/hiddenFeaturesReadiness";
import { buildFacebookLeadsAuthUrl } from "@/modules/facebook-leads/service/facebookLeadsService";

// The route only reads req.nextUrl.
const start = (query = "") => GET({ nextUrl: new URL(`http://localhost:3000/api/integrations/facebook/oauth/start${query}`) } as any);

describe("GET /api/integrations/facebook/oauth/start", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        (checkTeamPermission as any).mockResolvedValue(true);
        (resolveEnabledFeatureKeys as any).mockResolvedValue(new Set(["creator-funnel"]));
    });

    it("keeps the Lead Ads connect as the default purpose", async () => {
        const res = await start("?next=/settings/crm");

        expect(await res.json()).toEqual({ authUrl: "https://facebook.test/dialog" });
        expect(buildFacebookLeadsAuthUrl).toHaveBeenCalledWith({ teamId: "team-1", userId: "user-1", purpose: "leads", nextPath: "/settings/crm" });
        expect(resolveEnabledFeatureKeys).not.toHaveBeenCalled();
    });

    it("starts the social connect only for teams with the creator funnel on", async () => {
        await start("?purpose=social&next=/settings/social");
        expect(buildFacebookLeadsAuthUrl).toHaveBeenCalledWith({ teamId: "team-1", userId: "user-1", purpose: "social", nextPath: "/settings/social" });

        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        (checkTeamPermission as any).mockResolvedValue(true);
        (resolveEnabledFeatureKeys as any).mockResolvedValue(new Set());
        expect((await start("?purpose=social")).status).toBe(404);
        expect(buildFacebookLeadsAuthUrl).not.toHaveBeenCalled();
    });

    it("requires a team admin", async () => {
        (checkTeamPermission as any).mockResolvedValue(false);
        expect((await start("?purpose=social")).status).toBe(403);
    });
});
