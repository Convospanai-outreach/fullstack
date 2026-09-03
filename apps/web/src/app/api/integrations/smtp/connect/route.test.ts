import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockEncryptCredential, mockVerifySmtpConfig } = vi.hoisted(() => ({
    mockPrisma: {
        connectedMailbox: { upsert: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockEncryptCredential: vi.fn(async (value: string) => `encrypted:${value}`),
    mockVerifySmtpConfig: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/security/credentialVault", () => ({ encryptCredential: mockEncryptCredential }));
vi.mock("@/lib/email/smtpClient", () => ({ verifySmtpConfig: mockVerifySmtpConfig }));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/api/integrations/smtp/connect", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /api/integrations/smtp/connect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEncryptCredential.mockImplementation(async (value: string) => `encrypted:${value}`);
        mockVerifySmtpConfig.mockResolvedValue({ ok: true });
    });

    it("rejects an unauthenticated caller before touching the database", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(
            postRequest({ host: "smtp.evil.com", port: 587, user: "u", password: "p", email: "attacker@evil.com" })
        );

        expect(res.status).toBe(401);
        expect(mockPrisma.connectedMailbox.upsert).not.toHaveBeenCalled();
    });

    it("scopes the upsert to the caller's own team, not an arbitrary team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.connectedMailbox.upsert.mockResolvedValue({ id: "mailbox-1", email: "me@example.com" });

        const res = await POST(
            postRequest({ host: "smtp.example.com", port: 587, user: "u", password: "p", email: "me@example.com" })
        );

        expect(res.status).toBe(200);
        expect(mockPrisma.connectedMailbox.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teamId_email: { teamId: "team-1", email: "me@example.com" } },
                create: expect.objectContaining({ teamId: "team-1" }),
            })
        );
    });
});
