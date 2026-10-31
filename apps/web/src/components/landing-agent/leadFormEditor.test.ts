import { describe, expect, it } from "vitest";
import { decodeLeadFormMarkerId, encodeLeadFormMarkerId, LEAD_FORM_MAX_FIELDS, parseLeadFormConfig, type LeadFormConfig } from "@/modules/landing-agent/leadFormConfig";
import { hasLeadFormMarker } from "@/modules/landing-agent/leadFormHtml";
import {
    addLeadFormField,
    LEAD_FORM_DEFAULT_CONFIG,
    leadFormBlockContent,
    leadFormOfSelection,
    leadFormProblem,
    moveLeadFormField,
    parseOptionLines,
    previewLeadFormHtml,
    removeLeadFormField,
    setLeadFormSetting,
    updateLeadFormField,
} from "./leadFormEditor";

const base = LEAD_FORM_DEFAULT_CONFIG;

describe("default config and block", () => {
    it("is a valid config with one email field and the agreed texts", () => {
        expect(parseLeadFormConfig(LEAD_FORM_DEFAULT_CONFIG)).not.toBeNull();
        expect(LEAD_FORM_DEFAULT_CONFIG.fields).toEqual([{ key: "email", label: "Work email", type: "email", required: true }]);
        expect(LEAD_FORM_DEFAULT_CONFIG.buttonLabel).toBe("Send it to me");
        expect(LEAD_FORM_DEFAULT_CONFIG.successMessage).toBe("Thanks! Check your inbox.");
    });

    it("the block inserts a marker that decodes to the default config", () => {
        const content = leadFormBlockContent();
        expect(hasLeadFormMarker(content)).toBe(true);
        const id = /id="([^"]+)"/.exec(content)?.[1] ?? "";
        expect(decodeLeadFormMarkerId(id)).toEqual(LEAD_FORM_DEFAULT_CONFIG);
    });
});

describe("selection", () => {
    it("recognises a lead form marker and its config", () => {
        const id = encodeLeadFormMarkerId(base);
        expect(leadFormOfSelection({ id, classes: ["cmf-form"] })).toEqual({ config: base });
    });

    it("returns null for other components", () => {
        expect(leadFormOfSelection({ id: "hero-1", classes: ["la-section"] })).toBeNull();
        expect(leadFormOfSelection({ id: "cmf-form-x", classes: ["card"] })).toBeNull();
    });

    it("flags a marker whose id no longer decodes, so it can be reset", () => {
        expect(leadFormOfSelection({ id: "cmf-form-bad", classes: ["cmf-form"] })).toEqual({ config: null });
    });
});

describe("field operations", () => {
    it("adds a text field with a unique key, up to the limit", () => {
        const once = addLeadFormField(base);
        expect(once.fields).toHaveLength(2);
        expect(once.fields[1]).toMatchObject({ key: "field_1", type: "text", required: false });
        let full = base;
        for (let i = 0; i < 20; i++) full = addLeadFormField(full);
        expect(full.fields).toHaveLength(LEAD_FORM_MAX_FIELDS);
    });

    it("removes, moves and updates a field without touching the others", () => {
        const three = addLeadFormField(addLeadFormField(base));
        expect(removeLeadFormField(three, 1).fields.map((f) => f.key)).toEqual(["email", "field_2"]);
        expect(moveLeadFormField(three, 2, -1).fields.map((f) => f.key)).toEqual(["email", "field_2", "field_1"]);
        expect(moveLeadFormField(three, 0, -1)).toBe(three);
        const edited = updateLeadFormField(three, 1, { label: "Company", required: true });
        expect(edited.fields[1]).toMatchObject({ label: "Company", required: true, key: "field_1" });
        expect(edited.fields[0]).toEqual(three.fields[0]);
    });

    it("keeps options only for select fields, with a default option when switching to select", () => {
        const withText = addLeadFormField(base);
        const select = updateLeadFormField(withText, 1, { type: "select" });
        expect(select.fields[1].options).toEqual(["Option 1"]);
        expect(updateLeadFormField(select, 1, { type: "text" }).fields[1].options).toBeUndefined();
    });

    it("parses option lines, dropping blanks", () => {
        expect(parseOptionLines(" Small \n\nLarge\n  ")).toEqual(["Small", "Large"]);
    });
});

describe("settings and validation", () => {
    it("sets button and success texts; an empty redirect is removed", () => {
        const withRedirect = setLeadFormSetting(base, { redirectUrl: "https://example.com/thanks" });
        expect(withRedirect.redirectUrl).toBe("https://example.com/thanks");
        expect(setLeadFormSetting(withRedirect, { redirectUrl: "" }).redirectUrl).toBeUndefined();
        expect(setLeadFormSetting(base, { buttonLabel: "Go" }).buttonLabel).toBe("Go");
    });

    it("reports the first problem, or null for a valid config", () => {
        expect(leadFormProblem(base)).toBeNull();
        expect(leadFormProblem(setLeadFormSetting(base, { redirectUrl: "http://example.com" }))).toMatch(/https/);
        expect(leadFormProblem(setLeadFormSetting(base, { buttonLabel: "" }))).not.toBeNull();
        expect(leadFormProblem(updateLeadFormField(base, 0, { key: "Name" }))).not.toBeNull();
        expect(leadFormProblem(updateLeadFormField(addLeadFormField(base), 1, { type: "select", options: [] }))).not.toBeNull();
    });

    it("a field of type email must use the key email", () => {
        expect(leadFormProblem(updateLeadFormField(base, 0, { key: "work" }))).toMatch(/email/);
    });
});

describe("preview", () => {
    it("replaces the marker with the form so the Live Preview shows it", () => {
        const html = `<p>Hi</p>${leadFormBlockContent()}`;
        const out = previewLeadFormHtml(html);
        expect(out).toContain(`data-cmf-form="1"`);
        expect(out).not.toContain("cmf-form-");
    });
});
