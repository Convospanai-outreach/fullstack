import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, recordConsent } = vi.hoisted(() => ({
    db: {
        lead: { findUnique: vi.fn(), update: vi.fn() },
        consentLedger: { findFirst: vi.fn() },
    },
    recordConsent: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/modules/whatsapp/ConsentService", () => ({
    ConsentService: { recordConsent },
    ConsentMethod: { WEB_FORM: "WEB_FORM", PHONE_CALL: "PHONE_CALL" },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { recordCaptureConsent } from "./captureConsent";

const base = { leadId: "l1", userId: null, method: "WEB_FORM" as const, notes: "Landing form consent box", proof: "I agree to be emailed (page: launch, 2026-11-19T10:00:00Z)", ipAddress: "203.0.113.9" };

describe("recordCaptureConsent", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        db.lead.findUnique.mockResolvedValue({ id: "l1", status: "NEW" });
        db.consentLedger.findFirst.mockResolvedValue(null);
        db.lead.update.mockResolvedValue({});
        recordConsent.mockResolvedValue({});
    });

    it("writes one email ledger row with the channel, proof, ip and user, and keeps consentObtained in sync", async () => {
        const wrote = await recordCaptureConsent({ ...base, userId: "u1" });

        expect(wrote).toBe(true);
        expect(recordConsent).toHaveBeenCalledWith("l1", "u1", "WEB_FORM", "Landing form consent box", "EMAIL", { proof: base.proof, ipAddress: "203.0.113.9" });
        expect(db.lead.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { consentObtained: true } });
    });

    it("records the channel it was given", async () => {
        await recordCaptureConsent({ ...base, channel: "WHATSAPP" });
        expect(recordConsent).toHaveBeenCalledWith("l1", null, "WEB_FORM", expect.any(String), "WHATSAPP", expect.anything());
    });

    it("does not give consent back to a lead that opted out", async () => {
        db.lead.findUnique.mockResolvedValue({ id: "l1", status: "DNC" });

        expect(await recordCaptureConsent(base)).toBe(false);
        expect(recordConsent).not.toHaveBeenCalled();
        expect(db.lead.update).not.toHaveBeenCalled();
    });

    it("does not write a second row for the same proof (a retried job)", async () => {
        db.consentLedger.findFirst.mockResolvedValue({ id: "c1" });

        expect(await recordCaptureConsent(base)).toBe(false);
        expect(db.consentLedger.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { leadId: "l1", channel: "EMAIL", status: "GRANTED", proof: base.proof } }));
        expect(recordConsent).not.toHaveBeenCalled();
    });

    it("never throws into the capture path: the lead is already saved", async () => {
        recordConsent.mockRejectedValue(new Error("db"));

        await expect(recordCaptureConsent(base)).resolves.toBe(false);
        expect(db.lead.update).not.toHaveBeenCalled();
    });

    it("writes nothing for a lead that does not exist", async () => {
        db.lead.findUnique.mockResolvedValue(null);

        expect(await recordCaptureConsent(base)).toBe(false);
        expect(recordConsent).not.toHaveBeenCalled();
    });
});
