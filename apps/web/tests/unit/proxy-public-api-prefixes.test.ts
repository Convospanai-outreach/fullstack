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
