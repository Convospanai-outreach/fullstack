import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
    db: {
        lead: { findUnique: vi.fn(), update: vi.fn() },
        consentLedger: { findFirst: vi.fn(), create: vi.fn() },
    },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { recordCaptureConsent } from "./captureConsent";

const base = { leadId: "l1", userId: "u1", notes: "Consent column in a CSV import", proof: "Signed form 14 March", ipAddress: "203.0.113.9" };

describe("recordCaptureConsent (web)", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        db.lead.findUnique.mockResolvedValue({ id: "l1", status: "NEW" });
        db.consentLedger.findFirst.mockResolvedValue(null);
        db.consentLedger.create.mockResolvedValue({});
        db.lead.update.mockResolvedValue({});
    });

    it("writes one granted email row with channel, purpose, proof, ip and user, and keeps consentObtained in sync", async () => {
        expect(await recordCaptureConsent(base)).toBe(true);

        expect(db.consentLedger.create).toHaveBeenCalledWith({
            data: { leadId: "l1", userId: "u1", channel: "EMAIL", purpose: "MARKETING_AND_SUPPORT", status: "GRANTED", proof: "Signed form 14 March", notes: "Consent column in a CSV import", ipAddress: "203.0.113.9" },
        });
        expect(db.lead.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { consentObtained: true } });
    });

    it("does not give consent back to a lead that opted out", async () => {
        db.lead.findUnique.mockResolvedValue({ id: "l1", status: "DNC" });

        expect(await recordCaptureConsent(base)).toBe(false);
        expect(db.consentLedger.create).not.toHaveBeenCalled();
        expect(db.lead.update).not.toHaveBeenCalled();
    });

    it("does not write a second row for the same proof", async () => {
        db.consentLedger.findFirst.mockResolvedValue({ id: "c1" });

        expect(await recordCaptureConsent(base)).toBe(false);
        expect(db.consentLedger.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { leadId: "l1", channel: "EMAIL", status: "GRANTED", proof: "Signed form 14 March" } }));
        expect(db.consentLedger.create).not.toHaveBeenCalled();
    });

    it("never throws into the capture path, and leaves consentObtained alone when the row failed", async () => {
        db.consentLedger.create.mockRejectedValue(new Error("db"));

        await expect(recordCaptureConsent(base)).resolves.toBe(false);
        expect(db.lead.update).not.toHaveBeenCalled();
    });

    it("writes nothing for a lead that does not exist", async () => {
        db.lead.findUnique.mockResolvedValue(null);

        expect(await recordCaptureConsent(base)).toBe(false);
        expect(db.consentLedger.create).not.toHaveBeenCalled();
    });
});
