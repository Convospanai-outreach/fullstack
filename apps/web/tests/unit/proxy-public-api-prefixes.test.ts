// Imported from its implementation module, as in security-headers-s17.test.ts: the
// next/server shim declares NextRequest as a type only.
import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

// Public API prefixes match whole path segments: "/api/contact" is public, but a path that
// only starts with the same letters ("/api/contacts", "/api/registerx") still needs a session.

const callWithoutSession = async (path: string) => {
    const req = new NextRequest(`https://craftmyfunnel.live${path}`) as unknown as Parameters<typeof proxy>[0];
    return proxy(req);
};

describe("proxy public API prefixes", () => {
    it.each([
        "/api/contacts",
        "/api/helpdesk",
        "/api/registerx",
        "/api/healthz",
        "/api/checkout-admin",
        "/api/superadmin-tools",
        "/api/openapi.json.bak",
    ])("requires a session for %s, which only shares letters with a public prefix", async (path) => {
        const res = await callWithoutSession(path);
        expect(res.status).toBe(401);
    });

    it.each([
        "/api/contact",
        "/api/help/articles",
        "/api/register",
        "/api/health/",
        "/api/openapi.json",
        "/api/proxy/billing/plans",
    ])("still lets %s through without a session", async (path) => {
        const res = await callWithoutSession(path);
        expect(res.status).not.toBe(401);
    });
});

// The whole /api/auth and /api/proxy/auth trees are public (NextAuth plus the sign-up helpers).
describe("proxy auth API prefixes", () => {
    it.each(["/api/authors", "/api/authx", "/api/proxy/authz"])(
        "requires a session for %s",
        async (path) => {
            const res = await callWithoutSession(path);
            expect(res.status).toBe(401);
        },
    );

    it.each(["/api/auth/signin/google", "/api/auth/callback/google", "/api/auth/resend-verification", "/api/proxy/auth/session"])(
        "still lets %s through without a session",
        async (path) => {
            const res = await callWithoutSession(path);
            expect(res.status).not.toBe(401);
        },
    );
});

describe("proxy CORS exemption for extension routes", () => {
    // An extension origin isn't in ALLOWED_ORIGINS, so only the proxy's own preflight answer
    // sets Access-Control-Allow-Methods; a request passed on to the route handler gets none.
    const preflight = (path: string) => {
        const req = new NextRequest(`https://craftmyfunnel.live${path}`, {
            method: "OPTIONS",
            headers: { origin: "chrome-extension://abcdefghijklmnopabcdefghijklmnop" },
        }) as unknown as Parameters<typeof proxy>[0];
        return proxy(req);
    };

    it("leaves preflight for extension routes to the route handler", async () => {
        const res = await preflight("/api/extension/leads");
        expect(res.headers.get("Access-Control-Allow-Methods")).toBeNull();
    });

    it("answers preflight itself for a path that only starts with the extension prefix", async () => {
        const res = await preflight("/api/extensionx");
        expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PUT, DELETE, OPTIONS");
    });
});
