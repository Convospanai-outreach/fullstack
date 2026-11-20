import { describe, expect, it, vi } from "vitest";
import { buildSendGateReport } from "./dpdpSendGateReport";

const none = { lawfulBasis: "NONE", sourceUrl: null, publishedBySubject: false };

function fakeDb(leads: Array<Record<string, unknown>>, ledger: Array<Record<string, unknown>>) {
    return {
        team: {
            findMany: vi.fn().mockResolvedValue([
                { id: "t1", name: "Acme", sendSafety: { DPDP_SEND_GATE: true } },
                { id: "t2", name: "Beta", sendSafety: null },
            ]),
        },
        lead: {
            findMany: vi.fn().mockImplementation(async ({ where }: any) => (where.id ? [] : leads.filter((l) => l["teamId"] === where.teamId))),
        },
        consentLedger: {
            findMany: vi.fn().mockImplementation(async ({ where }: any) => ledger.filter((r) => where.leadId.in.includes(r["leadId"]))),
        },
    } as any;
}

describe("buildSendGateReport", () => {
    it("counts, per team, the leads that would be blocked per channel, and whether the gate is on", async () => {
        const leads = [
            { id: "a", teamId: "t1", ...none },
            { id: "b", teamId: "t1", ...none },
            { id: "c", teamId: "t1", lawfulBasis: "PUBLIC_SOURCE", sourceUrl: "https://example.com/p", publishedBySubject: true },
            { id: "d", teamId: "t2", ...none },
        ];
        const ledger = [{ leadId: "a", channel: "EMAIL", status: "GRANTED", revokedAt: null, grantedAt: new Date(1), purpose: "MARKETING_AND_SUPPORT" }];

        const report = await buildSendGateReport(fakeDb(leads, ledger));

        expect(report).toEqual([
            { teamId: "t1", teamName: "Acme", gateOn: true, leads: 3, blockedEmail: 1, blockedWhatsapp: 2 },
            { teamId: "t2", teamName: "Beta", gateOn: false, leads: 1, blockedEmail: 1, blockedWhatsapp: 1 },
        ]);
    });

    it("only reads: no write method is touched", async () => {
        const db = fakeDb([], []);
        await buildSendGateReport(db);
        expect(Object.keys(db.lead)).toEqual(["findMany"]);
        expect(Object.keys(db.consentLedger)).toEqual(["findMany"]);
        expect(Object.keys(db.team)).toEqual(["findMany"]);
    });
});
