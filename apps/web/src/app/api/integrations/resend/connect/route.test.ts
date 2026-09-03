import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockEncryptCredential, mockResendApiKeysList } = vi.hoisted(() => ({
    mockPrisma: {
        connectedMailbox: { upsert: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockEncryptCredential: vi.fn(async (value: string) => `encrypted:${value}`),
    mockResendApiKeysList: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/security/credentialVault", () => ({ encryptCredential: mockEncryptCredential }));
vi.mock("resend", () => ({
    Resend: function Resend() {
        return { apiKeys: { list: mockResendApiKeysList } };
    },
}));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/api/integrations/resend/connect", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /api/integrations/resend/connect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEncryptCredential.mockImplementation(async (value: string) => `encrypted:${value}`);
        mockResendApiKeysList.mockResolvedValue({ error: null });
    });

    it("rejects an unauthenticated caller before touching the database", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postRequest({ apiKey: "re_attacker_key", email: "attacker@evil.com" }));

        expect(res.status).toBe(401);
        expect(mockPrisma.connectedMailbox.upsert).not.toHaveBeenCalled();
    });

    it("scopes the upsert to the caller's own team, not an arbitrary team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.connectedMailbox.upsert.mockResolvedValue({ id: "mailbox-1", email: "me@example.com" });

        const res = await POST(postRequest({ apiKey: "re_key", email: "me@example.com" }));

        expect(res.status).toBe(200);
        expect(mockPrisma.connectedMailbox.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teamId_email: { teamId: "team-1", email: "me@example.com" } },
                create: expect.objectContaining({ teamId: "team-1" }),
            })
        );
    });
});
