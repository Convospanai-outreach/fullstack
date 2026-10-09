import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/linkedinLogin", () => ({
    connectLinkedInLogin: vi.fn(),
    linkedInLoginEnabled: vi.fn(),
    verifyLinkedInLoginState: vi.fn(),
    LinkedInLoginError: class LinkedInLoginError extends Error {},
}));

import { GET } from "./route";
import { auth } from "@/lib/auth";
import { connectLinkedInLogin, LinkedInLoginError, linkedInLoginEnabled, verifyLinkedInLoginState } from "@/lib/linkedinLogin";

const callback = (query: string) => GET({ nextUrl: new URL(`https://app.test/api/profile/linkedin-login/callback${query}`) } as any);
const result = (res: Response) => new URL(res.headers.get("location")!);

describe("GET /api/profile/linkedin-login/callback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["NEXTAUTH_URL"] = "https://app.test";
        (linkedInLoginEnabled as any).mockReturnValue(true);
        (verifyLinkedInLoginState as any).mockReturnValue({ userId: "user-1" });
        (auth as any).mockResolvedValue({ user: { id: "user-1" } });
    });

    it("connects LinkedIn for the signed-in person who started it and returns to Settings", async () => {
        const url = result(await callback("?code=c&state=s"));

        expect(url.pathname).toBe("/settings/general");
        expect(url.searchParams.get("linkedinLogin")).toBe("connected");
        expect(connectLinkedInLogin).toHaveBeenCalledWith({ code: "c", userId: "user-1" });
    });

    it("refuses when someone else, or nobody, is signed in to this browser", async () => {
        (auth as any).mockResolvedValue({ user: { id: "user-2" } });
        expect(result(await callback("?code=c&state=s")).searchParams.get("linkedinLoginError")).toMatch(/person who started/);
        (auth as any).mockResolvedValue(null);
        expect(result(await callback("?code=c&state=s")).searchParams.get("linkedinLoginError")).toMatch(/person who started/);
        expect(connectLinkedInLogin).not.toHaveBeenCalled();
    });

    it("refuses a bad state, a cancelled sign-in, a missing code, or the switch being off", async () => {
        (verifyLinkedInLoginState as any).mockReturnValueOnce(null);
        expect(result(await callback("?code=c&state=s")).searchParams.get("linkedinLoginError")).toMatch(/expired/);
        expect(result(await callback("?error=user_cancelled_login&state=s")).searchParams.get("linkedinLoginError")).toMatch(/cancelled/);
        expect(result(await callback("?state=s")).searchParams.get("linkedinLoginError")).toMatch(/sign-in code/);
        (linkedInLoginEnabled as any).mockReturnValueOnce(false);
        expect(result(await callback("?code=c&state=s")).searchParams.get("linkedinLoginError")).toMatch(/isn't available/);
        expect(connectLinkedInLogin).not.toHaveBeenCalled();
    });

    it("shows the reason when the LinkedIn profile can't be connected, and a plain message for anything else", async () => {
        (connectLinkedInLogin as any).mockRejectedValueOnce(new LinkedInLoginError("That LinkedIn profile already signs in to a different CraftMyFunnel account."));
        expect(result(await callback("?code=c&state=s")).searchParams.get("linkedinLoginError")).toMatch(/different CraftMyFunnel account/);
        vi.spyOn(console, "error").mockImplementation(() => {});
        (connectLinkedInLogin as any).mockRejectedValueOnce(new Error("db down"));
        expect(result(await callback("?code=c&state=s")).searchParams.get("linkedinLoginError")).toBe("Couldn't connect LinkedIn. Try again.");
    });
});
