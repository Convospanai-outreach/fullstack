import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    lead: { findFirst: vi.fn() },
    consentLedger: { findFirst: vi.fn() },
}));
const consent = vi.hoisted(() => ({ recordConsent: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/whatsapp/ConsentService", () => ({ ConsentService: consent, ConsentMethod: { WEB_FORM: "WEB_FORM" } }));

import { recordWhatsappOptIn, whatsappOptInText } from "../whatsappOptIn";

const signUp = (overrides: Record<string, unknown> = {}) => ({
    id: "ll-1",
    teamId: "team-a",
    phone: "+91 98765 43210",
    whatsappConsent: true,
    ipAddress: "203.0.113.7",
    pageVersion: 3,
    landingPage: { slug: "meal-plan", team: { name: "Asha's Kitchen" } },
    ...overrides,
});

describe("whatsappOptIn", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.lead.findFirst.mockResolvedValue({ phone: "+919876543210" });
        mockDb.consentLedger.findFirst.mockResolvedValue(null);
    });

    it("names WhatsApp and the business", () => {
        expect(whatsappOptInText("Asha's Kitchen")).toBe("Yes, Asha's Kitchen can message me on WhatsApp at the phone number above.");
    });

    it("records consent with the sign-up as proof when the lead has the number it was given for", async () => {
        expect(await recordWhatsappOptIn(signUp(), "lead-1")).toBe(true);
        expect(mockDb.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead-1", teamId: "team-a" }, select: { phone: true } });
        expect(consent.recordConsent).toHaveBeenCalledWith(
            "lead-1",
            null,
            "WEB_FORM",
            `Ticked on landing page /p/meal-plan (page version 3, wording v1): "Yes, Asha's Kitchen can message me on WhatsApp at the phone number above."`,
            "WHATSAPP",
            { proof: "landing_lead:ll-1", ipAddress: "203.0.113.7" },
        );
    });

    it("skips when the lead kept a different number (a merge), or no number was given", async () => {
        mockDb.lead.findFirst.mockResolvedValue({ phone: "+91 90000 00000" });
        expect(await recordWhatsappOptIn(signUp(), "lead-1")).toBe(false);
        expect(await recordWhatsappOptIn(signUp({ phone: null }), "lead-1")).toBe(false);
        expect(await recordWhatsappOptIn(signUp({ phone: "12" }), "lead-1")).toBe(false);
        mockDb.lead.findFirst.mockResolvedValue(null);
        expect(await recordWhatsappOptIn(signUp(), "lead-1")).toBe(false);
        expect(consent.recordConsent).not.toHaveBeenCalled();
    });

    it("skips an unticked box and a retried job", async () => {
        expect(await recordWhatsappOptIn(signUp({ whatsappConsent: null }), "lead-1")).toBe(false);
        expect(mockDb.lead.findFirst).not.toHaveBeenCalled();
        mockDb.consentLedger.findFirst.mockResolvedValue({ id: "cl-1" });
        expect(await recordWhatsappOptIn(signUp(), "lead-1")).toBe(false);
        expect(mockDb.consentLedger.findFirst).toHaveBeenCalledWith({ where: { leadId: "lead-1", channel: "WHATSAPP", proof: "landing_lead:ll-1" }, select: { id: true } });
        expect(consent.recordConsent).not.toHaveBeenCalled();
    });
});
