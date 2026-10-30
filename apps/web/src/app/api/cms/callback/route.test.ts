import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const STATE = "a".repeat(32);
const fetchMock = vi.fn();

function callback(query: string, cookie: string | null = `cms_oauth_state=${STATE}`) {
    return GET(new Request(`https://www.example.com/api/cms/callback?${query}`, { headers: cookie ? { cookie } : {} }));
}

describe("GET /api/cms/callback", () => {
    beforeEach(() => {
        vi.stubEnv("NEXTAUTH_URL", "https://www.example.com");
        vi.stubEnv("CMS_GITHUB_CLIENT_ID", "client-id-123");
        vi.stubEnv("CMS_GITHUB_CLIENT_SECRET", "client-secret-456");
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it("exchanges the code for a token and hands it only to this site's own admin page", async () => {
        fetchMock.mockResolvedValue(Response.json({ access_token: "gho_realtoken" }));

        const res = await callback(`code=abc&state=${STATE}`);
        const html = await res.text();

        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://github.com/login/oauth/access_token",
            expect.objectContaining({ method: "POST" })
        );
        const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
        expect(body).toEqual({
            client_id: "client-id-123",
            client_secret: "client-secret-456",
            code: "abc",
            redirect_uri: "https://www.example.com/api/cms/callback",
        });
        expect(html).toContain("authorization:github:success:");
        expect(html).toContain("gho_realtoken");
        // The token is only sent to a reply that comes from the site's own origin.
        expect(html).toContain('"https://www.example.com"');
        expect(html).toMatch(/e\.origin\s*(===|!==)\s*ORIGIN/);
    });

    it("keeps the token out of headers and cookies, and clears the state cookie", async () => {
        fetchMock.mockResolvedValue(Response.json({ access_token: "gho_realtoken" }));

        const res = await callback(`code=abc&state=${STATE}`);

        expect(JSON.stringify([...res.headers])).not.toContain("gho_realtoken");
        expect(res.headers.get("set-cookie")).toMatch(/cms_oauth_state=;.*Max-Age=0/i);
        expect(res.headers.get("cache-control")).toContain("no-store");
    });

    it("cannot be made to run script by the value of the token", async () => {
        fetchMock.mockResolvedValue(Response.json({ access_token: "</script><script>alert(1)</script>" }));

        const html = await (await callback(`code=abc&state=${STATE}`)).text();

        expect(html).not.toContain("</script><script>alert(1)");
    });

    it.each([
        ["no state cookie", `code=abc&state=${STATE}`, null],
        ["a different state", "code=abc&state=" + "b".repeat(32), `cms_oauth_state=${STATE}`],
        ["no state in the address", "code=abc", `cms_oauth_state=${STATE}`],
    ])("refuses the login with %s, without calling GitHub", async (_label, query, cookie) => {
        const res = await callback(query, cookie);

        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(await res.text()).not.toContain("authorization:github:success");
    });

    it("tells the admin page when GitHub refuses the code", async () => {
        fetchMock.mockResolvedValue(Response.json({ error: "bad_verification_code" }));

        const html = await (await callback(`code=abc&state=${STATE}`)).text();

        expect(html).toContain("authorization:github:error:");
        expect(html).not.toContain("authorization:github:success");
    });

    it("tells the admin page when GitHub cannot be reached", async () => {
        fetchMock.mockRejectedValue(new Error("network down"));

        const res = await callback(`code=abc&state=${STATE}`);

        expect(await res.text()).toContain("authorization:github:error:");
    });

    it("says the login is not set up when the GitHub app is not configured", async () => {
        vi.stubEnv("CMS_GITHUB_CLIENT_SECRET", "");

        const res = await callback(`code=abc&state=${STATE}`);

        expect(res.status).toBe(503);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
