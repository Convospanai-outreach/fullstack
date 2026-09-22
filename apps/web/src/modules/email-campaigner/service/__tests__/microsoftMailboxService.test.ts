import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
    connectedMailbox: { findFirst: vi.fn(), upsert: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: mockDb }));

const mockEncryptCredential = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/credentialVault", () => ({
    encryptCredential: mockEncryptCredential,
}));

const mockFetch = vi.hoisted(() => vi.fn());

import { buildMicrosoftMailboxAuthUrl, connectMicrosoftMailbox } from "../microsoftMailboxService";

function response(data: any, ok = true) {
    return { ok, json: async () => data };
}

describe("microsoftMailboxService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = mockFetch as unknown as typeof fetch;
        process.env["NEXTAUTH_SECRET"] = "test-secret";
        process.env["MICROSOFT_CLIENT_ID"] = "client-id";
        process.env["MICROSOFT_CLIENT_SECRET"] = "client-secret";
        mockEncryptCredential.mockResolvedValue({ v: 1, cipher: "x", iv: "x", tag: "x" });
        mockDb.connectedMailbox.findFirst.mockResolvedValue(null);
        mockDb.connectedMailbox.upsert.mockImplementation(({ create }: any) => Promise.resolve({ id: "mailbox-1", ...create }));
    });

    describe("buildMicrosoftMailboxAuthUrl", () => {
        it("signs the caller's own teamId/userId into the state param", () => {
            const url = buildMicrosoftMailboxAuthUrl({ teamId: "team-alpha", userId: "user-1" });
            const parsed = new URL(url);
            const state = parsed.searchParams.get("state")!;
            const [body] = state.split(".");
            const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
            expect(payload.teamId).toBe("team-alpha");
            expect(payload.userId).toBe("user-1");
        });

        // Mirrors the Google/Facebook guard: the redirect_uri must match the Azure
        // registration exactly, so prod refuses to fall back to a guessed host.
        it("refuses to build an OAuth URL in production without MICROSOFT_REDIRECT_URI", () => {
            vi.stubEnv("NODE_ENV", "production");
            vi.stubEnv("MICROSOFT_REDIRECT_URI", "");
            try {
                expect(() => buildMicrosoftMailboxAuthUrl({ teamId: "t", userId: "u" })).toThrow(
                    /MICROSOFT_REDIRECT_URI is not set/
                );
                vi.stubEnv("MICROSOFT_REDIRECT_URI", "https://craftmyfunnel.live/api/integrations/microsoft/oauth/callback");
                expect(() => buildMicrosoftMailboxAuthUrl({ teamId: "t", userId: "u" })).not.toThrow();
            } finally {
                vi.unstubAllEnvs();
            }
        });
    });

    describe("connectMicrosoftMailbox", () => {
        it("rejects a state with an invalid signature", async () => {
            await expect(connectMicrosoftMailbox({ code: "auth-code", state: "tampered.state" })).rejects.toThrow(
                /Invalid OAuth state/
            );
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it("scopes the created mailbox to the team signed into state, not any caller-supplied value", async () => {
            mockFetch
                .mockResolvedValueOnce(response({ access_token: "at", refresh_token: "rt", expires_in: 3600 }))
                .mockResolvedValueOnce(response({ mail: "user@company.com", displayName: "User" }));

            const state = buildMicrosoftMailboxAuthUrl({ teamId: "team-alpha", userId: "user-1" });
            const stateParam = new URL(state).searchParams.get("state")!;

            const result = await connectMicrosoftMailbox({ code: "auth-code", state: stateParam });

            expect(mockDb.connectedMailbox.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { teamId_email: { teamId: "team-alpha", email: "user@company.com" } },
                    create: expect.objectContaining({ teamId: "team-alpha", email: "user@company.com" }),
                })
            );
            expect(result.mailbox.email).toBe("user@company.com");
        });

        it("rejects when the mailbox is already connected to a different team", async () => {
            mockFetch
                .mockResolvedValueOnce(response({ access_token: "at", expires_in: 3600 }))
                .mockResolvedValueOnce(response({ mail: "shared@company.com" }));
            mockDb.connectedMailbox.findFirst.mockResolvedValue({ teamId: "team-victim", email: "shared@company.com" });

            const state = buildMicrosoftMailboxAuthUrl({ teamId: "team-attacker", userId: "user-2" });
            const stateParam = new URL(state).searchParams.get("state")!;

            await expect(connectMicrosoftMailbox({ code: "auth-code", state: stateParam })).rejects.toThrow(
                /already connected to another team/
            );
            expect(mockDb.connectedMailbox.upsert).not.toHaveBeenCalled();
        });
    });
});
