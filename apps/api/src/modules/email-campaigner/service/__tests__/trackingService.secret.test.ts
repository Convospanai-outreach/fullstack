import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockCheckRateLimit } = vi.hoisted(() => ({
    mockPrisma: {
        email: { findUnique: vi.fn(), updateMany: vi.fn() },
        emailEvent: { create: vi.fn() },
    },
    mockCheckRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mockCheckRateLimit }));

import { recordEmailOpen } from "../trackingService";

const KEYS = ["NEXTAUTH_SECRET", "AUTH_SECRET", "ENCRYPTION_KEY"] as const;

describe("tracking metadata key", () => {
    const saved: Record<string, string | undefined> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        for (const key of KEYS) {
            saved[key] = process.env[key];
            delete process.env[key];
        }
        mockPrisma.email.findUnique.mockResolvedValue({
            id: "email-1",
            leadId: null,
            campaignId: "camp-1",
            mailboxId: null,
            campaign: { teamId: "team-1" },
        });
        mockPrisma.email.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.emailEvent.create.mockResolvedValue({});
        mockCheckRateLimit.mockResolvedValue({ allowed: true });
    });

    afterEach(() => {
        for (const key of KEYS) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
        }
    });

    const open = () => recordEmailOpen({ token: "abcdefgh12345", headers: new Headers({ "x-forwarded-for": "203.0.113.9" }) });

    it("refuses to hash visitor IPs when no secret is configured, instead of using a public constant", async () => {
        await expect(open()).rejects.toThrow(/secret/i);
        expect(mockPrisma.email.updateMany).not.toHaveBeenCalled();
    });

    it("records the open once a secret is configured", async () => {
        process.env["NEXTAUTH_SECRET"] = "a-configured-secret-value";

        await expect(open()).resolves.toEqual({ recorded: true });
    });

    it("keys the IP hash on the configured secret", async () => {
        process.env["NEXTAUTH_SECRET"] = "secret-one";
        await open();
        const first = mockCheckRateLimit.mock.calls[0]![0];

        process.env["NEXTAUTH_SECRET"] = "secret-two";
        await open();
        const second = mockCheckRateLimit.mock.calls[1]![0];

        expect(first).not.toBe(second);
    });
});
