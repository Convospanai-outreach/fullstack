import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    consentLedger: { findFirst: vi.fn(), create: vi.fn() },
    whatsAppMessage: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { ConsentService } from "../ConsentService";

describe("ConsentService.validateConsent", () => {
    beforeEach(() => vi.clearAllMocks());

    it("goes by the lead's latest ledger entry for the channel", async () => {
        mockDb.consentLedger.findFirst.mockResolvedValue({ status: "GRANTED" });
        expect(await ConsentService.validateConsent("lead-1", "WHATSAPP")).toEqual({ hasConsent: true });
        expect(mockDb.consentLedger.findFirst).toHaveBeenCalledWith({
            where: { leadId: "lead-1", channel: "WHATSAPP" },
            orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
            select: { status: true, purpose: true },
        });
    });

    it("blocks a lead who opted out after granting, and one who never granted", async () => {
        mockDb.consentLedger.findFirst.mockResolvedValue({ status: "REVOKED" });
        expect(await ConsentService.validateConsent("lead-1")).toEqual({ hasConsent: false, reason: "WHATSAPP consent was revoked" });
        mockDb.consentLedger.findFirst.mockResolvedValue(null);
        expect((await ConsentService.validateConsent("lead-1")).hasConsent).toBe(false);
    });
});

describe("replying to someone who messaged first", () => {
    beforeEach(() => vi.clearAllMocks());

    it("allows replies while the customer's last message is under 24 hours old", async () => {
        mockDb.consentLedger.findFirst.mockResolvedValue({ status: "GRANTED", purpose: "INBOUND_REPLY" });
        mockDb.whatsAppMessage.findFirst.mockResolvedValue({ id: "m1" });
        expect(await ConsentService.validateConsent("lead-1")).toEqual({ hasConsent: true });
        const where = mockDb.whatsAppMessage.findFirst.mock.calls[0][0].where;
        expect(where.leadId).toBe("lead-1");
        expect(where.direction).toBe("INBOUND");
        const age = Date.now() - where.createdAt.gte.getTime();
        expect(Math.abs(age - 24 * 60 * 60 * 1000)).toBeLessThan(5000);
    });

    it("stops allowing replies once the window has closed", async () => {
        mockDb.consentLedger.findFirst.mockResolvedValue({ status: "GRANTED", purpose: "INBOUND_REPLY" });
        mockDb.whatsAppMessage.findFirst.mockResolvedValue(null);
        const result = await ConsentService.validateConsent("lead-1");
        expect(result.hasConsent).toBe(false);
        expect(result.reason).toMatch(/24-hour reply window/);
    });

    it("does not time-limit real consent", async () => {
        mockDb.consentLedger.findFirst.mockResolvedValue({ status: "GRANTED", purpose: "MARKETING_AND_SUPPORT" });
        expect(await ConsentService.validateConsent("lead-1")).toEqual({ hasConsent: true });
        expect(mockDb.whatsAppMessage.findFirst).not.toHaveBeenCalled();
    });

    it("opens the reply window only for a lead with no consent history, so it never undoes an opt-out", async () => {
        mockDb.consentLedger.findFirst.mockResolvedValue(null);
        await ConsentService.recordInboundReplyWindow("lead-1");
        expect(mockDb.consentLedger.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ leadId: "lead-1", channel: "WHATSAPP", purpose: "INBOUND_REPLY", status: "GRANTED", userId: null }),
        });

        mockDb.consentLedger.create.mockClear();
        mockDb.consentLedger.findFirst.mockResolvedValue({ id: "old" });
        await ConsentService.recordInboundReplyWindow("lead-1");
        expect(mockDb.consentLedger.create).not.toHaveBeenCalled();
    });
});
