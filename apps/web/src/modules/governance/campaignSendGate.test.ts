import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        team: { findUnique: vi.fn() },
        lead: { findMany: vi.fn() },
        consentLedger: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { summarizeCampaignSendGate } from "./campaignSendGate";

const none = { lawfulBasis: "NONE", sourceUrl: null, publishedBySubject: false };

describe("summarizeCampaignSendGate", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mockDb.team.findUnique.mockResolvedValue({ sendSafety: { DPDP_SEND_GATE: true } });
        mockDb.lead.findMany.mockResolvedValue([]);
        mockDb.consentLedger.findMany.mockResolvedValue([]);
    });

    it("with the flag off, reports the gate off and reads no leads", async () => {
        mockDb.team.findUnique.mockResolvedValue({ sendSafety: null });

        expect(await summarizeCampaignSendGate("team-1", "camp-1")).toEqual({ gateOn: false });
        expect(mockDb.lead.findMany).not.toHaveBeenCalled();
    });

    it("counts the campaign's leads that have neither consent nor a proven public source", async () => {
        mockDb.lead.findMany.mockResolvedValue([
            { id: "a", ...none },
            { id: "b", ...none },
            { id: "c", lawfulBasis: "PUBLIC_SOURCE", sourceUrl: "https://example.com/team", publishedBySubject: true },
        ]);
        mockDb.consentLedger.findMany.mockResolvedValue([{ leadId: "a", channel: "EMAIL", status: "GRANTED", revokedAt: null, grantedAt: new Date(1), purpose: "MARKETING_AND_SUPPORT" }]);

        expect(await summarizeCampaignSendGate("team-1", "camp-1")).toEqual({
            gateOn: true,
            total: 3,
            blocked: 1,
            reason: "No consent or proven public source",
        });
    });

    it("counts a lead whose consent was revoked as blocked", async () => {
        mockDb.lead.findMany.mockResolvedValue([{ id: "a", ...none }]);
        mockDb.consentLedger.findMany.mockResolvedValue([
            { leadId: "a", channel: "EMAIL", status: "GRANTED", revokedAt: null, grantedAt: new Date(1), purpose: "MARKETING_AND_SUPPORT" },
            { leadId: "a", channel: "EMAIL", status: "REVOKED", revokedAt: null, grantedAt: new Date(2), purpose: "REVOCATION" },
        ]);

        expect(await summarizeCampaignSendGate("team-1", "camp-1")).toMatchObject({ total: 1, blocked: 1 });
    });

    it("reads only this team's leads in this campaign, and only email ledger rows", async () => {
        mockDb.lead.findMany.mockResolvedValue([{ id: "a", ...none }]);

        await summarizeCampaignSendGate("team-1", "camp-1");

        expect(mockDb.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { campaignId: "camp-1", teamId: "team-1" } }));
        expect(mockDb.consentLedger.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { leadId: { in: ["a"] }, channel: "EMAIL" } }));
    });

    it("reports an empty campaign as nothing blocked", async () => {
        expect(await summarizeCampaignSendGate("team-1", "camp-1")).toMatchObject({ gateOn: true, total: 0, blocked: 0 });
    });
});
