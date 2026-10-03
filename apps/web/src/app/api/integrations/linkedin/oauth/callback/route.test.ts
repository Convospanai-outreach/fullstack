import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentContext: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: vi.fn(), TeamRole: { ADMIN: "admin" } }));
vi.mock("@/lib/hiddenFeaturesReadiness", () => ({ resolveEnabledFeatureKeys: vi.fn() }));
vi.mock("@/modules/creator-funnel/linkedinConnect", () => ({
    connectLinkedIn: vi.fn(),
    linkedInAvailable: vi.fn(),
    verifyLinkedInState: vi.fn(),
    LinkedInConnectError: class LinkedInConnectError extends Error {},
}));

import { GET } from "./route";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission } from "@/lib/permissions";
import { resolveEnabledFeatureKeys } from "@/lib/hiddenFeaturesReadiness";
import { connectLinkedIn, linkedInAvailable, verifyLinkedInState } from "@/modules/creator-funnel/linkedinConnect";

const callback = (query: string) => GET({ nextUrl: new URL(`https://app.test/api/integrations/linkedin/oauth/callback${query}`) } as any);
const result = (res: Response) => new URL(res.headers.get("location")!).searchParams;

describe("GET /api/integrations/linkedin/oauth/callback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["WEB_BASE_URL"] = "https://app.test";
        (verifyLinkedInState as any).mockReturnValue({ teamId: "team-1", userId: "user-1", kind: "profile" });
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        (checkTeamPermission as any).mockResolvedValue(true);
        (resolveEnabledFeatureKeys as any).mockResolvedValue(new Set(["creator-funnel"]));
        (linkedInAvailable as any).mockResolvedValue(true);
        (connectLinkedIn as any).mockResolvedValue(1);
    });

    it("connects for the person who started the sign-in and returns to Settings", async () => {
        const res = await callback("?code=c&state=s");
        expect(new URL(res.headers.get("location")!).pathname).toBe("/settings/social");
        expect(result(res).get("connected")).toBe("true");
        expect(connectLinkedIn).toHaveBeenCalledWith({ code: "c", state: { teamId: "team-1", userId: "user-1", kind: "profile" } });
    });

    it("refuses when someone else's sign-in link is finished in this browser", async () => {
        (getCurrentContext as any).mockResolvedValue({ userId: "user-2", teamId: "team-9" });
        expect(result(await callback("?code=c&state=s")).get("connected")).toBe("false");
        (getCurrentContext as any).mockResolvedValue({ userId: null, teamId: null });
        expect(result(await callback("?code=c&state=s")).get("connected")).toBe("false");
        expect(connectLinkedIn).not.toHaveBeenCalled();
    });

    it("refuses a bad state, a non-admin, or a workspace without the creator funnel", async () => {
        (verifyLinkedInState as any).mockReturnValueOnce(null);
        await callback("?code=c&state=s");
        (checkTeamPermission as any).mockResolvedValueOnce(false);
        await callback("?code=c&state=s");
        (resolveEnabledFeatureKeys as any).mockResolvedValueOnce(new Set());
        await callback("?code=c&state=s");
        (linkedInAvailable as any).mockResolvedValueOnce(false);
        await callback("?code=c&state=s");
        expect(connectLinkedIn).not.toHaveBeenCalled();
    });

    it("reports a cancelled sign-in and a pages sign-in with no pages", async () => {
        expect(result(await callback("?error=user_cancelled_authorize&state=s")).get("error")).toBe("LinkedIn sign-in was cancelled.");
        (connectLinkedIn as any).mockResolvedValueOnce(0);
        expect(result(await callback("?code=c&state=s")).get("error")).toMatch(/No LinkedIn pages/);
    });
});
