import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentContext: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: vi.fn(), TeamRole: { ADMIN: "admin" } }));
vi.mock("@/lib/hiddenFeaturesReadiness", () => ({ resolveEnabledFeatureKeys: vi.fn() }));
vi.mock("@/modules/instagram-login/service/instagramLoginService", () => ({ buildInstagramLoginAuthUrl: vi.fn(() => "https://instagram.test/oauth/authorize") }));

import { GET } from "./route";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission } from "@/lib/permissions";
import { resolveEnabledFeatureKeys } from "@/lib/hiddenFeaturesReadiness";
import { buildInstagramLoginAuthUrl } from "@/modules/instagram-login/service/instagramLoginService";

// The route only reads req.nextUrl.
const start = (query = "") => GET({ nextUrl: new URL(`http://localhost:3000/api/integrations/instagram/oauth/start${query}`) } as any);

describe("GET /api/integrations/instagram/oauth/start", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        (checkTeamPermission as any).mockResolvedValue(true);
        (resolveEnabledFeatureKeys as any).mockResolvedValue(new Set(["creator-funnel"]));
    });

    it("returns the Instagram sign-in URL for a team admin with the creator funnel on", async () => {
        const res = await start("?next=/settings/social");
        expect(await res.json()).toEqual({ authUrl: "https://instagram.test/oauth/authorize" });
        expect(buildInstagramLoginAuthUrl).toHaveBeenCalledWith({ teamId: "team-1", userId: "user-1", nextPath: "/settings/social" });
    });

    it("404s without the creator funnel, 403s for non-admins, 401s when signed out", async () => {
        (resolveEnabledFeatureKeys as any).mockResolvedValue(new Set());
        expect((await start()).status).toBe(404);
        (resolveEnabledFeatureKeys as any).mockResolvedValue(new Set(["creator-funnel"]));
        (checkTeamPermission as any).mockResolvedValue(false);
        expect((await start()).status).toBe(403);
        (getCurrentContext as any).mockResolvedValue({ userId: null, teamId: null });
        expect((await start()).status).toBe(401);
        expect(buildInstagramLoginAuthUrl).not.toHaveBeenCalled();
    });

    it("reports a configuration problem instead of redirecting into a broken sign-in", async () => {
        (buildInstagramLoginAuthUrl as any).mockImplementationOnce(() => {
            throw new Error("INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be configured.");
        });
        const res = await start();
        expect(res.status).toBe(500);
        // The detail (which settings are missing) goes to the server log, not the response.
        expect(await res.json()).toEqual({ error: "Unable to start Instagram sign-in." });
    });
});
