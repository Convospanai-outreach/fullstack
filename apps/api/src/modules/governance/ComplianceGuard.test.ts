import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { update: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
        suppressionEntry: { upsert: vi.fn() },
        consentLedger: { updateMany: vi.fn() },
        auditLog: { create: vi.fn() },
    },
}));
const { classifyReply } = vi.hoisted(() => ({ classifyReply: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/ai/jev", () => ({ classifyReply }));
vi.mock("@/lib/ai/SovereignFirewall", () => ({
    SovereignFirewall: {
        mask: async (t: string) => ({ safeContext: t, tokenMap: new Map() }),
        maskKnownNames: (t: string) => ({ safeContext: t }),
    },
}));

import { complianceGuard } from "./ComplianceGuard";

beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.consentLedger.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.auditLog.create.mockResolvedValue({});
});

describe("ComplianceGuard.enforceOptOut", () => {
    it("marks the lead DNC and also suppresses its address for the lead's own team", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: "Person@Example.com" });

        await complianceGuard.enforceOptOut("l1", "Instagram flow: the person asked to stop");

        expect(mockPrisma.lead.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DNC" }) }));
        expect(mockPrisma.suppressionEntry.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teamId_email: { teamId: "t1", email: "person@example.com" } },
                create: expect.objectContaining({ teamId: "t1", email: "person@example.com", reason: "OPT_OUT", leadId: "l1" }),
            }),
        );
    });

    // AuditLog.orgId and actorId are foreign keys (Team, User): "SYSTEM" is rejected by the database.
    it("writes the opt-out audit row for the lead's own team with no actor, not a 'SYSTEM' placeholder", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: "p@example.com" });

        await complianceGuard.enforceOptOut("l1", "stop");

        const row = mockPrisma.auditLog.create.mock.calls.map((c) => c[0].data).find((d) => d.action === "COMPLIANCE_OPT_OUT");
        expect(row).toEqual(expect.objectContaining({ orgId: "t1", actorId: null, entity: "Lead", entityId: "l1", metadata: { reason: "stop" } }));
        expect(JSON.stringify(mockPrisma.auditLog.create.mock.calls)).not.toContain("SYSTEM");
    });

    it("still enforces the opt-out when the audit row cannot be written", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: "p@example.com" });
        mockPrisma.auditLog.create.mockRejectedValue(new Error("fk"));
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(complianceGuard.enforceOptOut("l1", "stop")).resolves.toBeUndefined();

        expect(mockPrisma.suppressionEntry.upsert).toHaveBeenCalled();
        spy.mockRestore();
    });

    it("revokes every granted consent row for the lead, on every channel, and stamps revokedAt", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: "p@example.com" });

        await complianceGuard.enforceOptOut("l1", "stop");

        const arg = mockPrisma.consentLedger.updateMany.mock.calls[0]![0];
        expect(arg.where).toEqual({ leadId: "l1", status: "GRANTED" });
        expect(arg.data).toEqual({ status: "REVOKED", revokedAt: expect.any(Date) });
    });

    it("revokes consent even when the lead has no email (a WhatsApp-only lead)", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: null });

        await complianceGuard.enforceOptOut("l1", "stop");

        expect(mockPrisma.consentLedger.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { leadId: "l1", status: "GRANTED" } }));
    });

    it("also revokes consent on same-email duplicate leads in the same team, never in another team", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: "p@example.com" });

        await complianceGuard.enforceOptOut("l1", "stop");

        expect(mockPrisma.consentLedger.updateMany).toHaveBeenCalledTimes(2);
        const dup = mockPrisma.consentLedger.updateMany.mock.calls[1]![0];
        expect(dup.where).toEqual({ status: "GRANTED", lead: { email: "p@example.com", teamId: "t1", id: { not: "l1" } } });
        expect(dup.data).toEqual({ status: "REVOKED", revokedAt: expect.any(Date) });
    });

    it("does not touch duplicates when the lead has no team (it could match every team)", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: null, email: "p@example.com" });

        await complianceGuard.enforceOptOut("l1", "stop");

        expect(mockPrisma.consentLedger.updateMany).toHaveBeenCalledTimes(1);
    });

    it("lets a failed revoke surface so the job retries, instead of reporting the opt-out as done", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: "p@example.com" });
        mockPrisma.consentLedger.updateMany.mockRejectedValue(new Error("db"));

        await expect(complianceGuard.enforceOptOut("l1", "stop")).rejects.toThrow("db");
    });

    it("does not suppress when the lead has no email", async () => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: null });

        await complianceGuard.enforceOptOut("l1", "stop");

        expect(mockPrisma.suppressionEntry.upsert).not.toHaveBeenCalled();
    });
});

describe("ComplianceGuard.checkInboundMessage", () => {
    beforeEach(() => {
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: "p@example.com" });
        mockPrisma.lead.findFirst.mockResolvedValue({ teamId: "t1", fullName: "P", company: "Acme" });
    });
    const suppressed = () => mockPrisma.suppressionEntry.upsert.mock.calls.length > 0;
    const auditMeta = () => mockPrisma.auditLog.create.mock.calls.map((c) => c[0].data).find((d) => d.action === "COMPLIANCE_INBOUND_CLASSIFIED")?.metadata;

    it("suppresses on a clear opt-out even when the model is down", async () => {
        classifyReply.mockRejectedValue(new Error("down"));
        expect(await complianceGuard.checkInboundMessage("l1", "Please unsubscribe me")).toBe("OPT_OUT");
        expect(suppressed()).toBe(true);
        expect(classifyReply).not.toHaveBeenCalled();
        expect(auditMeta()).toEqual({ class: "OPT_OUT", pass: "deterministic" });
    });

    it("does not mark 'remove the pricing slide' or 'stopped by' as an opt-out", async () => {
        classifyReply.mockResolvedValue({ classification: "QUESTION", confidence: 0.9, reasoning: "" });
        expect(await complianceGuard.checkInboundMessage("l1", "Can you remove the pricing slide from the deck?")).toBe("NEUTRAL");
        expect(await complianceGuard.checkInboundMessage("l1", "I stopped by your booth last week")).toBe("NEUTRAL");
        expect(suppressed()).toBe(false);
        expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });

    it("does not suppress 'not interested'", async () => {
        expect(await complianceGuard.checkInboundMessage("l1", "Not interested, thanks")).toBe("NOT_INTERESTED");
        expect(suppressed()).toBe(false);
    });

    it("treats a model failure as UNSURE and never suppresses", async () => {
        classifyReply.mockRejectedValue(new Error("timeout"));
        expect(await complianceGuard.checkInboundMessage("l1", "Let us talk about the contract terms")).toBe("UNSURE");
        expect(suppressed()).toBe(false);
        expect(auditMeta()).toEqual({ class: "UNSURE", pass: "model" });
    });

    it("sends Hinglish to UNSURE, not NEUTRAL", async () => {
        expect(await complianceGuard.checkInboundMessage("l1", "mujhe mat bhejo")).toBe("UNSURE");
        expect(suppressed()).toBe(false);
    });

    it("uses the model for the rest and maps its answer", async () => {
        classifyReply.mockResolvedValue({ classification: "DNC", confidence: 0.95, reasoning: "x" });
        expect(await complianceGuard.checkInboundMessage("l1", "I would rather not hear from your company anymore")).toBe("OPT_OUT");
        expect(suppressed()).toBe(true);
        expect(auditMeta()).toEqual({ class: "OPT_OUT", pass: "model" });
    });

    it("never writes the message text to the audit log", async () => {
        classifyReply.mockResolvedValue({ classification: "INTERESTED", confidence: 0.9, reasoning: "x" });
        await complianceGuard.checkInboundMessage("l1", "secret-body-text about pricing");
        expect(JSON.stringify(mockPrisma.auditLog.create.mock.calls)).not.toContain("secret-body-text");
    });
});
