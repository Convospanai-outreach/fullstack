import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockCheckTeamPermission, mockEncryptCredential, mockVerifySmtpConfig } = vi.hoisted(() => ({
    mockPrisma: {
        connectedMailbox: { upsert: vi.fn(), findUnique: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockEncryptCredential: vi.fn(async (value: string) => `encrypted:${value}`),
    mockVerifySmtpConfig: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
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
        mockCheckTeamPermission.mockResolvedValue(true);
        mockEncryptCredential.mockImplementation(async (value: string) => `encrypted:${value}`);
        mockVerifySmtpConfig.mockResolvedValue({ ok: true });
        mockPrisma.connectedMailbox.findUnique.mockResolvedValue(null);
    });

    it("rejects an unauthenticated caller before touching the database", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(
            postRequest({ host: "smtp.evil.com", port: 587, user: "u", password: "p", email: "attacker@evil.com" })
        );

        expect(res.status).toBe(401);
        expect(mockPrisma.connectedMailbox.upsert).not.toHaveBeenCalled();
    });

    it("rejects a caller below ADMIN role before verifying/persisting SMTP credentials (OPEN-214)", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await POST(
            postRequest({ host: "smtp.evil.com", port: 587, user: "u", password: "p", email: "attacker@evil.com" })
        );

        expect(res.status).toBe(403);
        expect(mockVerifySmtpConfig).not.toHaveBeenCalled();
        expect(mockPrisma.connectedMailbox.upsert).not.toHaveBeenCalled();
    });

    it("saves the DKIM selector in the mailbox metadata, lower-cased, and keeps a saved one when a reconnect leaves it out", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.connectedMailbox.upsert.mockResolvedValue({ id: "mailbox-1", email: "me@example.com" });
        const base = { host: "smtp.example.com", port: 587, user: "u", password: "p", email: "me@example.com" };

        await POST(postRequest({ ...base, dkimSelector: " S1 " }));
        expect(mockPrisma.connectedMailbox.upsert.mock.calls[0][0].create.metadata).toMatchObject({ dkimSelector: "s1" });

        mockPrisma.connectedMailbox.findUnique.mockResolvedValue({ metadata: { host: "x", dkimSelector: "mail" } });
        await POST(postRequest(base));
        expect(mockPrisma.connectedMailbox.upsert.mock.calls[1][0].update.metadata).toMatchObject({ dkimSelector: "mail" });
    });

    it("refuses a selector with characters a DNS name should not carry, before verifying SMTP", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        const res = await POST(postRequest({ host: "h", port: 587, user: "u", password: "p", email: "me@example.com", dkimSelector: "bad selector;x" }));
        expect(res.status).toBe(400);
        expect(mockVerifySmtpConfig).not.toHaveBeenCalled();
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
