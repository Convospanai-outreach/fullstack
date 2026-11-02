import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.hoisted(() => vi.fn());
vi.mock("next-auth/jwt", () => ({ getToken }));

import { proxy } from "@/proxy";

// /whatsapp is a feature-gated path: the browser has the feature cookie once the sidebar has loaded the
// workspace's enabled features, and without it the proxy sends the visitor to Settings > Features.
const request = (url: string) =>
    new NextRequest(url, { headers: { cookie: "convo-hidden-features=whatsapp" } }) as unknown as Parameters<typeof proxy>[0];
const policy = (res: Awaited<ReturnType<typeof proxy>>) => res.headers.get("Content-Security-Policy") ?? "";
const directive = (csp: string, name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? "";

describe("Meta's WhatsApp signup popup", () => {
    beforeEach(() => {
        vi.stubEnv("NODE_ENV", "production");
        getToken.mockResolvedValue({ sub: "user-1", enterpriseRole: "ORG_ADMIN" });
    });
    afterEach(() => vi.unstubAllEnvs());

    it("lets the WhatsApp page load Meta's SDK and talk to Meta, on that page only", async () => {
        const whatsapp = policy(await proxy(request("https://craftmyfunnel.live/whatsapp")));
        const inbox = policy(await proxy(request("https://craftmyfunnel.live/inbox")));

        expect(directive(whatsapp, "script-src")).toContain("https://connect.facebook.net");
        expect(directive(whatsapp, "connect-src")).toContain("https://graph.facebook.com");
        expect(directive(whatsapp, "frame-src")).toContain("https://www.facebook.com");
        expect(directive(inbox, "script-src")).not.toContain("facebook.net");
        expect(directive(inbox, "connect-src")).not.toContain("facebook.com");
        expect(directive(inbox, "frame-src")).not.toContain("facebook.com");
    });

    it("does not open the same exception to a lookalike path", async () => {
        const lookalike = policy(await proxy(request("https://craftmyfunnel.live/whatsappx")));

        expect(directive(lookalike, "script-src")).not.toContain("facebook.net");
    });
});
