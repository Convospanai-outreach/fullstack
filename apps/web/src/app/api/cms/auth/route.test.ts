import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

function start() {
    return GET(new Request("https://www.example.com/api/cms/auth?provider=github&site_id=www.example.com&scope=repo"));
}

describe("GET /api/cms/auth", () => {
    beforeEach(() => {
        vi.stubEnv("NEXTAUTH_URL", "https://www.example.com");
        vi.stubEnv("CMS_GITHUB_CLIENT_ID", "client-id-123");
        vi.stubEnv("CMS_GITHUB_CLIENT_SECRET", "client-secret-456");
    });
    afterEach(() => vi.unstubAllEnvs());

    it("sends the editor to GitHub with a one-time state, registered callback and the narrowest scope", async () => {
        const res = await start();
        const location = new URL(res.headers.get("location")!);

        expect(res.status).toBe(302);
        expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
        expect(location.searchParams.get("client_id")).toBe("client-id-123");
        expect(location.searchParams.get("redirect_uri")).toBe("https://www.example.com/api/cms/callback");
        // The caller's own scope request is ignored: the public repo needs only public_repo.
        expect(location.searchParams.get("scope")).toBe("public_repo");
        expect(location.searchParams.get("state")).toMatch(/^[a-f0-9]{32}$/);
    });

    it("remembers the state in a short-lived cookie the page script cannot read, and never exposes the secret", async () => {
        const res = await start();
        const state = new URL(res.headers.get("location")!).searchParams.get("state");
        const cookie = res.headers.get("set-cookie") ?? "";

        expect(cookie).toContain(`cms_oauth_state=${state}`);
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=Lax/i);
        expect(cookie).toContain("Path=/api/cms");
        expect(cookie).toContain("Max-Age=600");
        expect(JSON.stringify([...res.headers])).not.toContain("client-secret-456");
    });

    it("uses a different state every time", async () => {
        const a = new URL((await start()).headers.get("location")!).searchParams.get("state");
        const b = new URL((await start()).headers.get("location")!).searchParams.get("state");

        expect(a).not.toBe(b);
    });

    it("says the login is not set up, instead of redirecting, when the GitHub app is not configured", async () => {
        vi.stubEnv("CMS_GITHUB_CLIENT_ID", "");

        const res = await start();

        expect(res.status).toBe(503);
        expect(res.headers.get("location")).toBeNull();
    });
});
