import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuditLog, mockFindMembership, mockHeaders } = vi.hoisted(() => ({
    mockAuditLog: vi.fn(),
    mockFindMembership: vi.fn(),
    mockHeaders: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { teamMember: { findFirst: mockFindMembership } } }));
vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: vi.fn() }));
vi.mock("@/lib/googleOnboarding", () => ({ syncGoogleUserToApp: vi.fn() }));
vi.mock("@/lib/passwordOnboarding", () => ({ provisionUserTeam: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: mockHeaders }));
vi.mock("next-auth/providers/google", () => ({ default: vi.fn(() => ({ id: "google" })) }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));
vi.mock("@/modules/audit/auditService", () => ({ AuditService: { log: mockAuditLog } }));

import { authOptions } from "../auth";

describe("authOptions.events - login and logout audit rows", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindMembership.mockResolvedValue({ teamId: "team-1" });
        mockAuditLog.mockResolvedValue(undefined);
        mockHeaders.mockResolvedValue(new Headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4, 10.0.0.1" }));
    });

    it("records the client IP on a login, taken from the trusted header", async () => {
        await authOptions.events!.signIn!({ user: { id: "user-1", email: "a@example.com" } } as any);

        expect(mockAuditLog).toHaveBeenCalledWith(
            "team-1", "user-1", "USER_LOGIN", "Auth", "user-1",
            { email: "a@example.com" },
            "203.0.113.7"
        );
    });

    it("never takes the IP from a forwarded-for entry the client could have set", async () => {
        mockHeaders.mockResolvedValue(new Headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.1" }));

        await authOptions.events!.signIn!({ user: { id: "user-1", email: "a@example.com" } } as any);

        expect(mockAuditLog.mock.calls[0]![6]).toBe("10.0.0.1");
    });

    it("still records the login when the request headers are unavailable", async () => {
        mockHeaders.mockRejectedValue(new Error("outside a request"));

        await authOptions.events!.signIn!({ user: { id: "user-1", email: "a@example.com" } } as any);

        expect(mockAuditLog).toHaveBeenCalledWith(
            "team-1", "user-1", "USER_LOGIN", "Auth", "user-1",
            { email: "a@example.com" },
            null
        );
    });

    it("records the client IP on a logout", async () => {
        mockAuditLog.mockReturnValue(Promise.resolve());

        await authOptions.events!.signOut!({ token: { id: "user-1", email: "a@example.com" } } as any);

        expect(mockAuditLog).toHaveBeenCalledWith(
            "team-1", "user-1", "USER_LOGOUT", "Auth", "user-1",
            { email: "a@example.com" },
            "203.0.113.7"
        );
    });
});
