import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.hoisted(() => vi.fn());
vi.mock("next-auth/jwt", () => ({ getToken }));

import { proxy } from "@/proxy";

const request = (url: string) => new NextRequest(url) as unknown as Parameters<typeof proxy>[0];
const policy = (res: Awaited<ReturnType<typeof proxy>>) => res.headers.get("Content-Security-Policy") ?? "";
const directive = (csp: string, name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";

describe("PostHog browser snippet", () => {
    beforeEach(() => {
        vi.stubEnv("NODE_ENV", "production");
        getToken.mockResolvedValue(null);
    });
    afterEach(() => vi.unstubAllEnvs());

    it("can load its script and send events, from the exact PostHog US hosts only", async () => {
        const csp = policy(await proxy(request("https://craftmyfunnel.live/")));

        expect(directive(csp, "script-src")).toContain("https://us-assets.i.posthog.com");
        expect(directive(csp, "connect-src")).toContain("https://us.i.posthog.com");
        expect(directive(csp, "connect-src")).toContain("https://us-assets.i.posthog.com");
        expect(csp).not.toMatch(/\*\.posthog\.com/);
    });
});
