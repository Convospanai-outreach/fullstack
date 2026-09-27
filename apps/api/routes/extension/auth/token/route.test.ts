import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, timingSafeEqualSpy } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn(), create: vi.fn() },
    },
    timingSafeEqualSpy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

// Wrap (not replace) timingSafeEqual - randomBytes and the real compare keep working.
vi.mock("crypto", async (importOriginal) => {
    const actual = await importOriginal<typeof import("crypto")>();
    timingSafeEqualSpy.mockImplementation(actual.timingSafeEqual);
    return { ...actual, default: { ...actual, timingSafeEqual: timingSafeEqualSpy }, timingSafeEqual: timingSafeEqualSpy };
});

import { POST } from "./route";

const EXTENSION_KEY = "test-extension-key";

function postRequest(sessionToken: string) {
    return new Request("http://localhost/api/extension/auth/token", {
        method: "POST",
        headers: {
            "x-extension-key": EXTENSION_KEY,
            authorization: `Bearer ${sessionToken}`,
        },
    }) as any;
}

describe("POST /extension/auth/token - rejects an already-expired session token (OPEN-229)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["EXTENSION_API_KEY"] = EXTENSION_KEY;
    });

    it("refuses to mint a fresh token from an expired session and never creates a new one", async () => {
        mockPrisma.session.findUnique.mockResolvedValue({
            sessionToken: "expired-token",
            expires: new Date(Date.now() - 60_000),
            user: { id: "user-1", memberships: [{ teamId: "team-a" }] },
        });

        const res = await POST(postRequest("expired-token"));

        expect(res.status).toBe(401);
        expect(mockPrisma.session.create).not.toHaveBeenCalled();
    });

    it("rejects a wrong extension key via the constant-time compare, before any lookup (S-11)", async () => {
        const req = new Request("http://localhost/api/extension/auth/token", {
            method: "POST",
            headers: { "x-extension-key": "wrong", authorization: "Bearer valid-token" },
        }) as any;

        const res = await POST(req);

        expect(res.status).toBe(401);
        expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
        expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1);
        const [provided, required] = timingSafeEqualSpy.mock.calls[0] as [Buffer, Buffer];
        expect(provided.length).toBe(required.length);
    });

    it("mints a fresh token from a still-valid session", async () => {
        mockPrisma.session.findUnique.mockResolvedValue({
            sessionToken: "valid-token",
            expires: new Date(Date.now() + 60_000),
            user: { id: "user-1", memberships: [{ teamId: "team-a" }] },
        });
        mockPrisma.session.create.mockResolvedValue({});

        const res = await POST(postRequest("valid-token"));

        expect(res.status).toBe(200);
        expect(mockPrisma.session.create).toHaveBeenCalled();
    });
});
