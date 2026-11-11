import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockSend } = vi.hoisted(() => ({
    mockPrisma: {
        team: { findUnique: vi.fn() },
        landingLead: { findFirst: vi.fn() },
    },
    mockSend: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/landing-agent/metaCapiSender", () => ({ sendMetaLeadEvents: mockSend }));

import { encryptCredential } from "@/lib/security/credentialVault";
import { NonRetryableJobError } from "@/lib/queue";
import { handleMetaCapiLead } from "./meta-capi-worker";

const TOKEN = "EAAB-secret-token-value";
const NOW = Math.floor(Date.now() / 1000);

function jobPayload(overrides: Record<string, unknown> = {}) {
    return {
        teamId: "team-1",
        landingLeadId: "lead-1",
        pixelId: "123456789012345",
        eventId: "11111111-2222-4333-8444-555555555555",
        eventTime: NOW,
        eventSourceUrl: "https://go.brand.test/spring",
        fbc: "fb.1.1800000000000.IwAR123",
        fbp: "fb.1.1800000000000.1234567890",
        ...overrides,
    };
}

describe("handleMetaCapiLead", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        process.env["ENCRYPTION_KEY"] = "a".repeat(64);
        mockPrisma.team.findUnique.mockResolvedValue({ metaCapiTokenEnc: await encryptCredential(TOKEN) });
        mockPrisma.landingLead.findFirst.mockResolvedValue({
            id: "lead-1",
            email: "John_Smith@gmail.com",
            name: "Mary Smith",
            phone: "+1 (650) 555-1212",
            ipAddress: "168.212.226.204",
            userAgent: "Mozilla/5.0 (test)",
        });
        mockSend.mockResolvedValue({ ok: true });
    });

    it("loads the team's token and lead (both team-scoped) and sends one Lead with the shared event_id", async () => {
        const result = await handleMetaCapiLead(jobPayload());

        expect(result).toEqual({ sent: true });
        expect(mockPrisma.team.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "team-1" } }));
        expect(mockPrisma.landingLead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead-1", teamId: "team-1" } }));
        const sent = mockSend.mock.calls[0]![0];
        expect(sent).toMatchObject({ pixelId: "123456789012345", accessToken: TOKEN });
        expect(sent.payload.data[0]).toMatchObject({ event_id: "11111111-2222-4333-8444-555555555555", event_name: "Lead" });
        expect(sent.payload).not.toHaveProperty("test_event_code");
    });

    it("passes the test event code only when the page set one", async () => {
        await handleMetaCapiLead(jobPayload({ testEventCode: "TEST12345" }));
        expect(mockSend.mock.calls[0]![0].payload).toHaveProperty("test_event_code", "TEST12345");
    });

    it("skips, without sending, an event older than six days", async () => {
        const result = await handleMetaCapiLead(jobPayload({ eventTime: NOW - 7 * 86400 }));
        expect(result).toEqual({ sent: false, reason: "event_too_old" });
        expect(mockSend).not.toHaveBeenCalled();
    });

    it("skips when the team has no token any more", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({ metaCapiTokenEnc: null });
        const result = await handleMetaCapiLead(jobPayload());
        expect(result).toEqual({ sent: false, reason: "no_token" });
        expect(mockSend).not.toHaveBeenCalled();
    });

    it("retries a retryable Meta failure and gives up on a permanent one", async () => {
        mockSend.mockResolvedValueOnce({ ok: false, retryable: true, status: 503, reason: "Meta responded 503" });
        await expect(handleMetaCapiLead(jobPayload())).rejects.toThrow("Meta responded 503");

        mockSend.mockResolvedValueOnce({ ok: false, retryable: false, status: 400, reason: "Meta responded 400" });
        await expect(handleMetaCapiLead(jobPayload())).rejects.toBeInstanceOf(NonRetryableJobError);
    });

    it("never includes the token in an error it throws", async () => {
        mockSend.mockResolvedValueOnce({ ok: false, retryable: false, status: 400, reason: "Meta responded 400" });
        const error = await handleMetaCapiLead(jobPayload()).catch((e: Error) => e);
        expect(String((error as Error).message)).not.toContain(TOKEN);
    });
});
