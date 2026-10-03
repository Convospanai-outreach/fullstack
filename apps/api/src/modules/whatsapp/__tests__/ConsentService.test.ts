import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({ consentLedger: { findFirst: vi.fn() } }));
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
            select: { status: true },
        });
    });

    it("blocks a lead who opted out after granting, and one who never granted", async () => {
        mockDb.consentLedger.findFirst.mockResolvedValue({ status: "REVOKED" });
        expect(await ConsentService.validateConsent("lead-1")).toEqual({ hasConsent: false, reason: "WHATSAPP consent was revoked" });
        mockDb.consentLedger.findFirst.mockResolvedValue(null);
        expect((await ConsentService.validateConsent("lead-1")).hasConsent).toBe(false);
    });
});
