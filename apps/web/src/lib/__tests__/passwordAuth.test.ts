import { vi } from "vitest";
import bcrypt from "bcryptjs";

const { mockPrisma, mockIsSsoEnforcedForEmail, mockCheckRateLimit, mockProvisionUserTeam } = vi.hoisted(() => ({
    mockPrisma: { user: { findUnique: vi.fn() } },
    mockIsSsoEnforcedForEmail: vi.fn(),
    mockCheckRateLimit: vi.fn(),
    mockProvisionUserTeam: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/passwordOnboarding", () => ({ provisionUserTeam: mockProvisionUserTeam }));
vi.mock("@/lib/sso/oidc", () => ({ isSsoEnforcedForEmail: mockIsSsoEnforcedForEmail }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mockCheckRateLimit }));

import { authorizeCredentials, registerSchema } from "../passwordAuth";

describe("authorizeCredentials", () => {
    const goodPassword = "correct horse battery";
    const hash = bcrypt.hashSync(goodPassword, 4);
    const verifiedUser = { id: "u1", email: "a@b.com", name: "Ada L", image: null, password: hash, emailVerified: new Date() };

    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetTime: 0 });
        mockIsSsoEnforcedForEmail.mockResolvedValue(false);
    });

    it("returns the user for a correct password on a verified account", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(verifiedUser);
        const result = await authorizeCredentials({ email: " A@B.com ", password: goodPassword });
        expect(result).toEqual({ id: "u1", email: "a@b.com", name: "Ada L", image: null });
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "a@b.com" } }));
        expect(mockProvisionUserTeam).toHaveBeenCalledWith("a@b.com");
    });

    it("rejects a wrong password", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(verifiedUser);
        expect(await authorizeCredentials({ email: "a@b.com", password: "wrong-password-123" })).toBeNull();
    });

    it("rejects an unknown email without revealing it", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        expect(await authorizeCredentials({ email: "nobody@b.com", password: goodPassword })).toBeNull();
    });

    it("rejects an account with no password (Google-only user)", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ ...verifiedUser, password: null });
        expect(await authorizeCredentials({ email: "a@b.com", password: goodPassword })).toBeNull();
    });

    it("rejects a correct password when the email is unverified", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ ...verifiedUser, emailVerified: null });
        await expect(authorizeCredentials({ email: "a@b.com", password: goodPassword })).rejects.toThrow("EMAIL_NOT_VERIFIED");
    });

    it("does not reveal unverified status for a wrong password", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ ...verifiedUser, emailVerified: null });
        expect(await authorizeCredentials({ email: "a@b.com", password: "wrong-password-123" })).toBeNull();
    });

    it("rejects when SSO is enforced for the email's domain", async () => {
        mockPrisma.user.findUnique.mockResolvedValue(verifiedUser);
        mockIsSsoEnforcedForEmail.mockResolvedValue(true);
        await expect(authorizeCredentials({ email: "a@b.com", password: goodPassword })).rejects.toThrow("SSO_REQUIRED");
    });

    it("rejects when rate limited, before touching the database", async () => {
        mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetTime: 0 });
        await expect(authorizeCredentials({ email: "a@b.com", password: goodPassword })).rejects.toThrow("RATE_LIMITED");
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns null for missing or over-long input", async () => {
        expect(await authorizeCredentials(undefined)).toBeNull();
        expect(await authorizeCredentials({ email: "a@b.com", password: "x".repeat(73) })).toBeNull();
    });
});

describe("registerSchema", () => {
    const valid = {
        firstName: " Ada ",
        lastName: "Lovelace",
        company: "Analytical Engines",
        phone: "+91 98765 43210",
        email: " Ada@Example.COM ",
        password: "a-long-enough-password",
    };

    it("normalizes a valid payload", () => {
        const parsed = registerSchema.parse(valid);
        expect(parsed.email).toBe("ada@example.com");
        expect(parsed.firstName).toBe("Ada");
    });

    it.each([
        ["short password", { password: "short" }],
        ["72+ char password", { password: "x".repeat(73) }],
        ["bad email", { email: "not-an-email" }],
        ["letters in phone", { phone: "call me maybe" }],
        ["too-short phone", { phone: "12345" }],
        ["blank first name", { firstName: "  " }],
        ["blank company", { company: "" }],
    ])("rejects %s", (_label, override) => {
        expect(registerSchema.safeParse({ ...valid, ...override }).success).toBe(false);
    });
});
