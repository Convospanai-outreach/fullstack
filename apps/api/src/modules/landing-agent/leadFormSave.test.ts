import { describe, expect, it } from "vitest";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "./leadFormConfig";
import { leadFormMarkerError } from "./leadFormSubmit";

const config = {
    fields: [{ key: "email", label: "Work email", type: "email", required: true }],
    buttonLabel: "Send",
    successMessage: "Thanks",
} as LeadFormConfig;

function page(html: string) {
    return { html, css: "" };
}

describe("leadFormMarkerError (save-time check)", () => {
    it("accepts a page with a valid marker, or no marker", () => {
        expect(leadFormMarkerError(page(`<section><div class="cmf-form" id="${encodeLeadFormMarkerId(config)}"></div></section>`))).toBeNull();
        expect(leadFormMarkerError(page("<p>No form here</p>"))).toBeNull();
    });

    it("refuses a marker whose config does not validate", () => {
        expect(leadFormMarkerError(page(`<div class="cmf-form" id="cmf-form-bm90LWpzb24"></div>`))).toMatch(/invalid configuration/);
    });

    it("refuses a marker whose redirect is not https", () => {
        const withHttp = Buffer.from(JSON.stringify({ ...config, redirectUrl: "https://" })).toString("base64url");
        expect(leadFormMarkerError(page(`<div class="cmf-form" id="cmf-form-${withHttp}"></div>`))).toMatch(/invalid configuration/);
    });

    it("checks every marker, not only the first", () => {
        const good = `<div class="cmf-form" id="${encodeLeadFormMarkerId(config)}"></div>`;
        expect(leadFormMarkerError(page(`${good}<div class="cmf-form" id="cmf-form-bad"></div>`))).not.toBeNull();
    });
});
