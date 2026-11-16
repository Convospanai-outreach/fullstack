import { describe, expect, it } from "vitest";
import { belongsToCampaign } from "./campaignApprovals";

const leads = new Set(["l1"]);

describe("belongsToCampaign", () => {
    it("matches a request on the campaign itself", () => {
        expect(belongsToCampaign({ entityType: "Campaign", entityId: "c1", payload: null }, "c1", leads)).toBe(true);
        expect(belongsToCampaign({ entityType: "Campaign", entityId: "c2", payload: null }, "c1", leads)).toBe(false);
    });

    it("matches a request on one of the campaign's leads", () => {
        expect(belongsToCampaign({ entityType: "Lead", entityId: "l1", payload: {} }, "c1", leads)).toBe(true);
        expect(belongsToCampaign({ entityType: "Lead", entityId: "other", payload: {} }, "c1", leads)).toBe(false);
    });

    it("matches a held message stored as leadId:channel", () => {
        expect(belongsToCampaign({ entityType: "Message", entityId: "l1:whatsapp", payload: {} }, "c1", leads)).toBe(true);
    });

    it("matches an email draft by the campaign or lead in its payload", () => {
        expect(belongsToCampaign({ entityType: "email", entityId: "e1", payload: { campaignId: "c1" } }, "c1", leads)).toBe(true);
        expect(belongsToCampaign({ entityType: "email", entityId: "e1", payload: { leadId: "l1" } }, "c1", leads)).toBe(true);
        expect(belongsToCampaign({ entityType: "email", entityId: "e1", payload: { campaignId: "c2", leadId: "x" } }, "c1", leads)).toBe(false);
    });
});
