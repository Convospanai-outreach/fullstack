import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockWarn, mockGetSession, mockFindUser } = vi.hoisted(() => ({
    mockWarn: vi.fn(),
    mockGetSession: vi.fn(),
    mockFindUser: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetSession }));
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mockFindUser } } }));
vi.mock("@/lib/requestContext", () => ({ RequestContext: { get: () => undefined } }));
vi.mock("@/lib/internalAuth", () => ({ internalAuthPath: vi.fn(), verifyInternalAuthHeaders: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mockWarn, info: vi.fn(), error: vi.fn() } }));

async function load() {
    vi.resetModules();
    return import("../admin");
}

describe("getAdminUser - refusals are logged", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSession.mockResolvedValue({ user: { email: "a@example.com" } });
    });

    it("logs a signed-in user who does not meet the admin level", async () => {
        mockFindUser.mockResolvedValue({ id: "user-1", role: "user", enterpriseRole: "ORG_ADMIN" });
        const { getAdminUser } = await load();

        const admin = await getAdminUser("SYSTEM_ADMIN" as any);

        expect(admin).toBeNull();
        expect(mockWarn).toHaveBeenCalledWith("authz.denied", { userId: "user-1", teamId: null, required: "admin:SYSTEM_ADMIN" });
    });

    it("does not log an admin who is allowed, or a visitor who is not signed in", async () => {
        mockFindUser.mockResolvedValue({ id: "user-2", role: "user", enterpriseRole: "SYSTEM_ADMIN" });
        const { getAdminUser } = await load();

        expect(await getAdminUser("SYSTEM_ADMIN" as any)).not.toBeNull();
        mockGetSession.mockResolvedValue(null);
        expect(await getAdminUser("SYSTEM_ADMIN" as any)).toBeNull();

        expect(mockWarn).not.toHaveBeenCalled();
    });
});
