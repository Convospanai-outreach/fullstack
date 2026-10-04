import { createHmac, timingSafeEqual } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInternalAuthHeaders } from "@/lib/internalAuthHeaders";
import {
    authenticateInternalRequest,
    internalAuthPath,
    verifyInternalAuthHeaders,
} from "../../../api/src/lib/internalAuth";

// Roadmap 3.5 / S-13. apps/web (Render) and apps/api (Oracle VMs) deploy separately,
// so for a while a NEW web build talks to an OLD api build and vice versa. These
// tests hold the new signer to both verifiers.

const { mockGetToken } = vi.hoisted(() => ({ mockGetToken: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: mockGetToken }));

import { POST as proxyPost } from "@/app/api/proxy/[...path]/route";
import { fetchSuperAdminUserDetail } from "@/lib/superadmin/apiClient";

const SECRET = "test-nextauth-secret";

// Verbatim copy of apps/api/server.ts verifyInternalAuthHeaders as of main 80f0f552,
// i.e. the api build that may still be live when this web build ships. Do not
// "update" it: its job is to stay the old verifier.
function oldApiVerifyInternalAuthHeaders(headers: Record<string, unknown>) {
    const secret = process.env["NEXTAUTH_SECRET"];
    if (!secret) return null;

    const userId = typeof headers['x-craftmyfunnel-user-id'] === 'string' ? headers['x-craftmyfunnel-user-id'] : '';
    const email = typeof headers['x-craftmyfunnel-user-email'] === 'string' ? headers['x-craftmyfunnel-user-email'] : '';
    const role = typeof headers['x-craftmyfunnel-user-role'] === 'string' ? headers['x-craftmyfunnel-user-role'] : '';
    const timestamp = typeof headers['x-craftmyfunnel-auth-ts'] === 'string' ? headers['x-craftmyfunnel-auth-ts'] : '';
    const signature = typeof headers['x-craftmyfunnel-auth-signature'] === 'string' ? headers['x-craftmyfunnel-auth-signature'] : '';

    if (!userId || !timestamp || !signature) return null;

    const issuedAt = Number(timestamp);
    if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > 5 * 60 * 1000) {
        return null;
    }

    const payload = `v1.${timestamp}.${userId}.${email}.${role}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(signature, 'hex');

    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
        return null;
    }

    return { sub: userId, email, enterpriseRole: role };
}

/** What Fastify hands the verifier: lower-cased header names, string values. */
function asFastifyHeaders(headers: Headers | Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    new Headers(headers).forEach((value, key) => {
        out[key] = value;
    });
    return out;
}

describe("internal auth signing across the web/api deploy gap", () => {
    const originalSecret = process.env["NEXTAUTH_SECRET"];
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["NEXTAUTH_SECRET"] = SECRET;
    });
    afterEach(() => {
        if (originalSecret === undefined) delete process.env["NEXTAUTH_SECRET"];
        else process.env["NEXTAUTH_SECRET"] = originalSecret;
        global.fetch = originalFetch;
    });

    function sign(method: string, path: string) {
        return buildInternalAuthHeaders({ secret: SECRET, userId: "user-1", email: "u@example.com", role: "SYSTEM_ADMIN", method, path });
    }

    it("NEW signer -> OLD api verifier: still authenticates (legacy v1 signature unchanged)", () => {
        expect(oldApiVerifyInternalAuthHeaders(sign("GET", "/leads/export"))).toEqual({
            sub: "user-1",
            email: "u@example.com",
            enterpriseRole: "SYSTEM_ADMIN",
        });
    });

    it("NEW signer -> NEW api verifier: authenticates via v2 bound to method + path", () => {
        const headers = sign("post", "/workflows/wf-1");
        expect(verifyInternalAuthHeaders(headers, { method: "POST", path: "/workflows/wf-1" })).toMatchObject({
            sub: "user-1",
            nonce: headers["x-craftmyfunnel-auth-nonce"],
        });
    });

    it("NEW signer -> NEW api verifier: a different path or method is rejected", () => {
        const headers = sign("GET", "/leads/export");
        expect(verifyInternalAuthHeaders(headers, { method: "GET", path: "/admin/users" })).toBeNull();
        expect(verifyInternalAuthHeaders(headers, { method: "DELETE", path: "/leads/export" })).toBeNull();
    });

    it("NEW signer -> NEW api verifier: each header set works exactly once", async () => {
        const headers = sign("GET", "/leads/export");
        const req = { method: "GET", path: "/leads/export" };
        expect(await authenticateInternalRequest(headers, req)).not.toBeNull();
        expect(await authenticateInternalRequest(headers, req)).toBeNull();
    });

    it("the /api/proxy route's headers pass the old verifier and the new one for the URL it actually calls", async () => {
        mockGetToken.mockResolvedValue({ sub: "user-1", email: "u@example.com", enterpriseRole: "USER" });
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        global.fetch = fetchMock as any;

        // "workflows" is never web-owned, so this is signed and forwarded to apps/api.
        const url = "http://localhost:3000/api/proxy/workflows/wf-1/runs?limit=5";
        const req = Object.assign(new Request(url, { method: "POST" }), { nextUrl: new URL(url) }) as any;
        await proxyPost(req, { params: Promise.resolve({ path: ["workflows", "wf-1", "runs"] }) });

        const [target, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
        const sent = asFastifyHeaders(init.headers as Headers);
        const apiRequest = { method: String(init.method), path: internalAuthPath(`${target.pathname}${target.search}`) };

        expect(oldApiVerifyInternalAuthHeaders(sent)?.sub).toBe("user-1");
        expect(verifyInternalAuthHeaders(sent, apiRequest)).toMatchObject({ sub: "user-1", nonce: expect.any(String) });
    });

    it("the superadmin client's headers verify for an encodeURIComponent-ed path segment", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
        global.fetch = fetchMock as any;

        await fetchSuperAdminUserDetail(
            { id: "admin-1", email: "a@example.com", enterpriseRole: "SUPER_ADMIN" },
            "google|user 42/x",
            "7d"
        );

        const [target, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
        const sent = asFastifyHeaders(init.headers as Record<string, string>);
        expect(target.pathname).toBe("/admin/super/users/google%7Cuser%2042%2Fx");

        expect(oldApiVerifyInternalAuthHeaders(sent)?.sub).toBe("admin-1");
        // nonce present = verified via v2 (method + path bound), not the legacy fallback.
        expect(
            verifyInternalAuthHeaders(sent, { method: "GET", path: internalAuthPath(`${target.pathname}${target.search}`) })
        ).toMatchObject({ sub: "admin-1", nonce: expect.any(String) });
    });
});
