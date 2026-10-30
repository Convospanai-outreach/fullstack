import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.hoisted(() => vi.fn());
vi.mock("next-auth/jwt", () => ({ getToken }));

import { proxy } from "@/proxy";

const request = (url: string) => new NextRequest(url) as unknown as Parameters<typeof proxy>[0];
const policy = (res: Awaited<ReturnType<typeof proxy>>) => res.headers.get("Content-Security-Policy") ?? "";
const directive = (csp: string, name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";

describe("the CMS admin and its GitHub login", () => {
    beforeEach(() => {
        vi.stubEnv("NODE_ENV", "production");
        getToken.mockResolvedValue(null);
    });
    afterEach(() => vi.unstubAllEnvs());

    it.each(["/cms", "/cms/config.yml", "/api/cms/auth", "/api/cms/callback"])(
        "lets a visitor with no site session reach %s: the GitHub login is the access control",
        async (path) => {
            const res = await proxy(request(`https://craftmyfunnel.live${path}`));

            expect(res.headers.get("location")).toBeNull();
            expect(res.status).toBe(200);
        }
    );

    it("does not make lookalike paths public", async () => {
        const res = await proxy(request("https://craftmyfunnel.live/cmsx"));

        expect(res.headers.get("location") ?? "").toContain("/login");
    });

    it("lets the admin page load Decap, call GitHub and show avatars, on that page only", async () => {
        const cms = policy(await proxy(request("https://craftmyfunnel.live/cms")));
        const home = policy(await proxy(request("https://craftmyfunnel.live/pricing")));

        expect(directive(cms, "script-src")).toContain("https://unpkg.com");
        expect(directive(cms, "connect-src")).toContain("https://api.github.com");
        expect(directive(cms, "img-src")).toContain("https://*.githubusercontent.com");
        expect(directive(home, "script-src")).not.toContain("unpkg.com");
        expect(directive(home, "connect-src")).not.toContain("api.github.com");
        expect(directive(home, "img-src")).not.toContain("githubusercontent.com");
    });
});
