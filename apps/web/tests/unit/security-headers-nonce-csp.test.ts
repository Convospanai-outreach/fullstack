// Imported from its implementation module: src/types/next-server-shim.d.ts redeclares
// `next/server` with NextRequest as a type-only interface (see security-headers-s17.test.ts).
import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.hoisted(() => vi.fn());
vi.mock("next-auth/jwt", () => ({ getToken }));

const connection = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<object>()), connection }));

import { proxy } from "@/proxy";

// Roadmap 3.6 part 2 (S-17): signed-in app pages get a per-request nonce and a strict
// script policy (report-only for now); public pages keep the existing policy and stay static.

const request = (url: string) => new NextRequest(url) as unknown as Parameters<typeof proxy>[0];

describe("3.6 pt2 — nonce CSP for the signed-in app", () => {
    beforeEach(() => {
        // Dev adds 'unsafe-eval' for HMR; these tests pin the production policy.
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://abc123@o42.ingest.sentry.io/4507");
        getToken.mockResolvedValue({ sub: "user-1", enterpriseRole: "ORG_ADMIN" });
    });
    afterEach(() => vi.unstubAllEnvs());

    it("sends a strict report-only policy with a fresh nonce on a signed-in page and forwards it to the renderer", async () => {
        const first = await proxy(request("https://craftmyfunnel.live/inbox"));
        const second = await proxy(request("https://craftmyfunnel.live/inbox"));

        const policy = first.headers.get("Content-Security-Policy-Report-Only") ?? "";
        const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
        expect(nonce).toBeTruthy();
        expect(policy).toContain("'strict-dynamic'");
        expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
        expect(policy).not.toMatch(/script-src[^;]*'unsafe-eval'/);
        expect(policy).toContain("report-uri https://o42.ingest.sentry.io/api/4507/security/?sentry_key=abc123");

        // NextResponse.next({ request }) carries overridden request headers this way.
        expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
        expect(first.headers.get("x-middleware-request-content-security-policy-report-only")).toBe(policy);

        expect(second.headers.get("Content-Security-Policy-Report-Only")).not.toContain(`'nonce-${nonce}'`);
    });

    it("leaves public pages on the existing policy, with no nonce", async () => {
        getToken.mockResolvedValue(null);
        const res = await proxy(request("https://craftmyfunnel.live/pricing"));

        expect(res.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
        expect(res.headers.get("x-middleware-request-x-nonce")).toBeNull();
        expect(res.headers.get("Content-Security-Policy")).toContain("script-src");
    });

    it("no longer allows WebSockets to any host", async () => {
        const res = await proxy(request("https://craftmyfunnel.live/pricing"));

        expect(res.headers.get("Content-Security-Policy")).not.toContain("wss://*");
    });
});

describe("3.6 pt2 — signed-in layouts render per request", () => {
    it("calls connection() in each signed-in route layout, so the nonce reaches the page", async () => {
        const layouts = await Promise.all([
            import("@/app/(dashboard)/layout"),
            import("@/app/setup/layout"),
            import("@/app/client/layout"),
            import("@/app/credits/layout"),
        ]);
        for (const layout of layouts) {
            connection.mockClear();
            await layout.default({ children: null });
            expect(connection).toHaveBeenCalledTimes(1);
        }
    });
});
