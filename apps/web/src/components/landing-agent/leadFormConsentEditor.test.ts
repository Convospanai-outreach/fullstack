import { describe, expect, it } from "vitest";
import { decodeLeadFormMarkerId, parseLeadFormConfig, type LeadFormConfig } from "@/modules/landing-agent/leadFormConfig";
import { LEAD_FORM_DEFAULT_CONFIG, leadFormBlockContent, leadFormProblem, setLeadFormConsent } from "./leadFormEditor";

const DEFAULT_TEXT = "I agree to be contacted about my enquiry and to the privacy policy.";

function markerConfig(html: string): LeadFormConfig | null {
    const id = /id="(cmf-form-[^"]+)"/.exec(html)?.[1] ?? "";
    return decodeLeadFormMarkerId(id);
}

describe("new lead forms ask for consent by default", () => {
    it("the default config has consent on, required, with the neutral wording", () => {
        expect(LEAD_FORM_DEFAULT_CONFIG.consent).toEqual({ enabled: true, required: true, text: DEFAULT_TEXT });
        expect(parseLeadFormConfig(LEAD_FORM_DEFAULT_CONFIG)).not.toBeNull();
    });

    it("a new block's marker carries the consent", () => {
        expect(markerConfig(leadFormBlockContent())?.consent).toEqual({ enabled: true, required: true, text: DEFAULT_TEXT });
    });
});

describe("setLeadFormConsent", () => {
    it("changes the wording and whether the box is required", () => {
        const next = setLeadFormConsent(LEAD_FORM_DEFAULT_CONFIG, { text: "Send me tips.", required: false });
        expect(next.consent).toMatchObject({ enabled: true, required: false, text: "Send me tips." });
    });

    it("switching consent off keeps the wording for later", () => {
        const off = setLeadFormConsent(LEAD_FORM_DEFAULT_CONFIG, { enabled: false });
        expect(off.consent).toMatchObject({ enabled: false, text: DEFAULT_TEXT });
    });

    it("trims the links and the contact email and removes them when cleared", () => {
        const set = setLeadFormConsent(LEAD_FORM_DEFAULT_CONFIG, {
            privacyUrl: " https://brand.test/privacy ",
            deletionUrl: "https://brand.test/delete",
            contactEmail: " privacy@brand.test ",
            deletionSteps: "Email us.",
        });
        expect(set.consent).toMatchObject({
            privacyUrl: "https://brand.test/privacy",
            deletionUrl: "https://brand.test/delete",
            contactEmail: "privacy@brand.test",
            deletionSteps: "Email us.",
        });
        const cleared = setLeadFormConsent(set, { privacyUrl: "  ", deletionUrl: "", contactEmail: "", deletionSteps: "" });
        expect(cleared.consent).not.toHaveProperty("privacyUrl");
        expect(cleared.consent).not.toHaveProperty("deletionUrl");
        expect(cleared.consent).not.toHaveProperty("contactEmail");
        expect(cleared.consent).not.toHaveProperty("deletionSteps");
    });

    it("turns consent on for a form that had none", () => {
        const { consent: _none, ...plain } = LEAD_FORM_DEFAULT_CONFIG;
        const on = setLeadFormConsent(plain as LeadFormConfig, { enabled: true, text: "Hi" });
        expect(on.consent).toMatchObject({ enabled: true, text: "Hi" });
    });
});

describe("the editor refuses a form its marker cannot hold", () => {
    it("reports a problem when the saved form would be too large for its marker", () => {
        const big = setLeadFormConsent(LEAD_FORM_DEFAULT_CONFIG, { deletionSteps: "x".repeat(2000) });
        expect(leadFormProblem(big)).toMatch(/too large/i);
    });

    it("a normal form has no problem", () => {
        expect(leadFormProblem(setLeadFormConsent(LEAD_FORM_DEFAULT_CONFIG, { deletionSteps: "Email us." }))).toBeNull();
    });
});
