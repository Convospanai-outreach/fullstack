import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        team: { findUnique: vi.fn() },
        lead: { findUnique: vi.fn() },
        consentLedger: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { canContact, checkSendGate, NO_LAWFUL_BASIS_REASON } from "./lawfulBasis";

const day = (n: number) => new Date(Date.UTC(2026, 10, n));
const granted = (channel: string, extra: Record<string, unknown> = {}) => ({ channel, status: "GRANTED", revokedAt: null, grantedAt: day(1), purpose: "MARKETING_AND_SUPPORT", ...extra });
const revoked = (channel: string, extra: Record<string, unknown> = {}) => ({ channel, status: "REVOKED", revokedAt: null, grantedAt: day(2), purpose: "REVOCATION", ...extra });
const noBasis = { lawfulBasis: "NONE", sourceUrl: null, publishedBySubject: false };
const publicSource = { lawfulBasis: "PUBLIC_SOURCE", sourceUrl: "https://example.com/about", publishedBySubject: true };

describe("canContact", () => {
    it("allows a lead with a granted consent row for the channel", () => {
        expect(canContact(noBasis, "EMAIL", [granted("EMAIL")])).toBe(true);
    });

    it("blocks a lead with no consent row and no public source", () => {
        expect(canContact(noBasis, "EMAIL", [])).toBe(false);
    });

    it("blocks when consent was later revoked (the revoke is a newer ledger row)", () => {
        expect(canContact(noBasis, "WHATSAPP", [granted("WHATSAPP"), revoked("WHATSAPP")])).toBe(false);
    });

    it("blocks a granted row that carries a revokedAt", () => {
        expect(canContact(noBasis, "EMAIL", [granted("EMAIL", { revokedAt: day(3) })])).toBe(false);
    });

    it("allows again when consent is re-granted after a revocation", () => {
        expect(canContact(noBasis, "EMAIL", [granted("EMAIL"), revoked("EMAIL"), granted("EMAIL", { grantedAt: day(3) })])).toBe(true);
    });

    it("does not count consent given for another channel", () => {
        expect(canContact(noBasis, "EMAIL", [granted("WHATSAPP")])).toBe(false);
    });

    it("does not count the WhatsApp reply-window row, which is not consent to outreach", () => {
        expect(canContact(noBasis, "WHATSAPP", [granted("WHATSAPP", { purpose: "INBOUND_REPLY" })])).toBe(false);
    });

    it("a reply-window row written after a revocation does not undo the revocation", () => {
        const rows = [granted("WHATSAPP"), revoked("WHATSAPP"), granted("WHATSAPP", { purpose: "INBOUND_REPLY", grantedAt: day(3) })];
        expect(canContact(noBasis, "WHATSAPP", rows)).toBe(false);
    });

    it("allows a public-source lead when the source URL is set and the subject published the contact", () => {
        expect(canContact(publicSource, "EMAIL", [])).toBe(true);
    });

    it.each([
        ["no source URL", { ...publicSource, sourceUrl: null }],
        ["a blank source URL", { ...publicSource, sourceUrl: "  " }],
        ["the subject did not publish it", { ...publicSource, publishedBySubject: false }],
        ["basis is NONE despite a URL", { ...noBasis, sourceUrl: "https://example.com", publishedBySubject: true }],
        ["basis is CONSENT with no ledger row", { lawfulBasis: "CONSENT", sourceUrl: null, publishedBySubject: false }],
    ])("blocks a public-source claim with %s", (_label, lead) => {
        expect(canContact(lead, "EMAIL", [])).toBe(false);
    });

    it("lets a revoked public-source lead stay blocked", () => {
        expect(canContact(publicSource, "EMAIL", [granted("EMAIL"), revoked("EMAIL")])).toBe(false);
    });
});

describe("checkSendGate", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockDb.team.findUnique.mockResolvedValue({ sendSafety: { DPDP_SEND_GATE: true } });
        mockDb.lead.findUnique.mockResolvedValue({ teamId: "team-1", ...noBasis });
        mockDb.consentLedger.findMany.mockResolvedValue([]);
    });

    const input = { leadId: "lead-1", teamId: "team-1", channel: "EMAIL" as const };

    it("with the flag off, allows everything and reads nothing else (old behaviour)", async () => {
        mockDb.team.findUnique.mockResolvedValue({ sendSafety: null });

        expect(await checkSendGate(input)).toEqual({ allowed: true });
        expect(mockDb.lead.findUnique).not.toHaveBeenCalled();
    });

    it.each([[undefined], [{}], [{ DPDP_SEND_GATE: false }], [{ DPDP_SEND_GATE: "true" }]])("treats sendSafety %j as flag off", async (sendSafety) => {
        mockDb.team.findUnique.mockResolvedValue({ sendSafety });

        expect((await checkSendGate(input)).allowed).toBe(true);
    });

    it("with the flag on, sends a lead that has granted consent", async () => {
        mockDb.consentLedger.findMany.mockResolvedValue([granted("EMAIL")]);

        expect(await checkSendGate(input)).toEqual({ allowed: true });
    });

    it("with the flag on, blocks a lead with no basis and says why", async () => {
        expect(await checkSendGate(input)).toEqual({ allowed: false, reason: NO_LAWFUL_BASIS_REASON });
        expect(NO_LAWFUL_BASIS_REASON).toBe("No consent or proven public source");
    });

    it("with the flag on, blocks a lead whose consent was revoked", async () => {
        mockDb.consentLedger.findMany.mockResolvedValue([granted("EMAIL"), revoked("EMAIL")]);

        expect((await checkSendGate(input)).allowed).toBe(false);
    });

    it("with the flag on, blocks a public-source lead that has no source URL", async () => {
        mockDb.lead.findUnique.mockResolvedValue({ teamId: "team-1", lawfulBasis: "PUBLIC_SOURCE", sourceUrl: null, publishedBySubject: true });

        expect((await checkSendGate(input)).allowed).toBe(false);
    });

    it("with the flag on, sends a proven public-source lead", async () => {
        mockDb.lead.findUnique.mockResolvedValue({ teamId: "team-1", ...publicSource });

        expect(await checkSendGate(input)).toEqual({ allowed: true });
    });

    it("blocks a lead that belongs to another team", async () => {
        mockDb.lead.findUnique.mockResolvedValue({ teamId: "team-2", ...publicSource });

        expect((await checkSendGate(input)).allowed).toBe(false);
    });

    it("blocks a lead that does not exist", async () => {
        mockDb.lead.findUnique.mockResolvedValue(null);

        expect((await checkSendGate(input)).allowed).toBe(false);
    });

    it("reads only the ledger rows for the channel being sent on", async () => {
        await checkSendGate({ ...input, channel: "WHATSAPP" });

        expect(mockDb.consentLedger.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { leadId: "lead-1", channel: "WHATSAPP" } }));
    });

    it("lets a database failure propagate rather than sending unchecked", async () => {
        mockDb.consentLedger.findMany.mockRejectedValue(new Error("db down"));

        await expect(checkSendGate(input)).rejects.toThrow("db down");
    });
});
