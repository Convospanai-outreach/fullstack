import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInternalAuthHeaders } from "@/lib/internalAuthHeaders";
import {
    authenticateInternalRequest,
    internalAuthPath,
    verifyInternalAuthHeaders,
} from "../../../api/src/lib/internalAuth";

// Roadmap 3.5 / S-13. Holds the web signer (and the two routes that use it) to the
// apps/api verifier, which accepts only the v2 format.

const { mockGetToken } = vi.hoisted(() => ({ mockGetToken: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ getToken: mockGetToken }));

import { POST as proxyPost } from "@/app/api/proxy/[...path]/route";
import { fetchSuperAdminUserDetail } from "@/lib/superadmin/apiClient";

const SECRET = "test-nextauth-secret";

/** What Fastify hands the verifier: lower-cased header names, string values. */
function asFastifyHeaders(headers: Headers | Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    new Headers(headers).forEach((value, key) => {
        out[key] = value;
    });
    return out;
}

describe("internal auth signing", () => {
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

    it("sends only the v2 signature, not the legacy v1 one", () => {
        expect(sign("GET", "/leads/export")).not.toHaveProperty("x-craftmyfunnel-auth-signature");
    });

    it("signer -> api verifier: authenticates via v2 bound to method + path", () => {
        const headers = sign("post", "/workflows/wf-1");
        expect(verifyInternalAuthHeaders(headers, { method: "POST", path: "/workflows/wf-1" })).toMatchObject({
            sub: "user-1",
            nonce: headers["x-craftmyfunnel-auth-nonce"],
        });
    });

    it("signer -> api verifier: a different path or method is rejected", () => {
        const headers = sign("GET", "/leads/export");
        expect(verifyInternalAuthHeaders(headers, { method: "GET", path: "/admin/users" })).toBeNull();
        expect(verifyInternalAuthHeaders(headers, { method: "DELETE", path: "/leads/export" })).toBeNull();
    });

    it("signer -> api verifier: each header set works exactly once", async () => {
        const headers = sign("GET", "/leads/export");
        const req = { method: "GET", path: "/leads/export" };
        expect(await authenticateInternalRequest(headers, req)).not.toBeNull();
        expect(await authenticateInternalRequest(headers, req)).toBeNull();
    });

    it("the /api/proxy route's headers verify for the URL it actually calls", async () => {
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

        expect(
            verifyInternalAuthHeaders(sent, { method: "GET", path: internalAuthPath(`${target.pathname}${target.search}`) })
        ).toMatchObject({ sub: "admin-1", nonce: expect.any(String) });
    });
});
