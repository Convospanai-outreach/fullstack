import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockInfo } = vi.hoisted(() => ({
    mockPrisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
    mockInfo: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: mockInfo, warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/emailService", () => ({
    EmailService: { createVerificationToken: vi.fn().mockResolvedValue("tok"), sendVerificationEmail: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@/lib/rateLimit", () => ({ applyRateLimit: vi.fn().mockResolvedValue(null), RATE_LIMITS: { REGISTRATION: {} } }));
vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/passwordAuth", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/passwordAuth")>()),
    hashPassword: vi.fn().mockResolvedValue("hashed"),
}));
vi.mock("@/lib/botCheck", () => ({
    allowForEmail: vi.fn().mockResolvedValue(true),
    clientIpFromRequest: () => "203.0.113.20",
    isBreachedPassword: vi.fn().mockResolvedValue(false),
    looksLikeBot: () => false,
    verifyTurnstile: vi.fn().mockResolvedValue(true),
}));

import { POST } from "./route";

const signup = {
    email: "new.user@example.com",
    password: "a-long-enough-passphrase-1!",
    firstName: "New",
    lastName: "User",
    phone: "+14155550123",
    company: "Acme",
};

function register(body: unknown = signup) {
    return POST(new Request("http://localhost/api/register", { method: "POST", body: JSON.stringify(body) }) as any);
}

describe("POST /api/register - record of the new account", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({ id: "user-new" });
    });

    it("logs that the account was created, from where, without the email or password", async () => {
        const res = await register();

        expect(res.status).toBe(201);
        expect(mockInfo).toHaveBeenCalledWith("auth.registered", { userId: "user-new", ip: "203.0.113.20" });
        const logged = JSON.stringify(mockInfo.mock.calls);
        expect(logged).not.toContain("new.user@example.com");
        expect(logged).not.toContain("a-long-enough-passphrase-1!");
    });

    it("logs nothing when the email is already registered", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" });

        const res = await register();

        expect(res.status).toBe(409);
        expect(mockInfo).not.toHaveBeenCalled();
    });
});
