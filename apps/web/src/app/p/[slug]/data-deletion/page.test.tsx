import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "@/modules/landing-agent/leadFormConfig";
import DataDeletionPage from "./page";

const DEFAULT = "contact the site owner";

const config = {
    fields: [{ key: "email", label: "Work email", type: "email", required: true }],
    buttonLabel: "Send it to me",
    successMessage: "Thanks! Check your inbox.",
    consent: {
        enabled: true,
        required: true,
        text: "I agree to be contacted.",
        deletionSteps: "Email us with the subject DELETE.\nWe remove your data within 30 days.",
        contactEmail: "privacy@brand.test",
    },
} as LeadFormConfig;

async function renderDeletion(fetchImpl: () => Promise<unknown>) {
    vi.stubGlobal("fetch", fetchImpl);
    const element = await DataDeletionPage({ params: Promise.resolve({ slug: "guide" }) });
    return renderToStaticMarkup(element);
}

describe("data-deletion page", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("shows the deletion steps and the contact email from the page's form", async () => {
        const html = `<section><div class="cmf-form" id="${encodeLeadFormMarkerId(config)}"></div></section>`;
        const markup = await renderDeletion(async () => ({ ok: true, json: async () => ({ renderedJson: { html, css: "" } }) }));
        expect(markup).toContain("Email us with the subject DELETE.");
        expect(markup).toContain("We remove your data within 30 days.");
        expect(markup).toContain('href="mailto:privacy@brand.test"');
        expect(markup).not.toContain(DEFAULT);
    });

    it("escapes quotes and ampersands in the steps", async () => {
        const quoted = { ...config, consent: { ...config.consent!, deletionSteps: "Say \"hi\" & bye" } } as LeadFormConfig;
        const html = `<section><div class="cmf-form" id="${encodeLeadFormMarkerId(quoted)}"></div></section>`;
        const markup = await renderDeletion(async () => ({ ok: true, json: async () => ({ renderedJson: { html, css: "" } }) }));
        expect(markup).toContain("Say &quot;hi&quot; &amp; bye");
        expect(markup).not.toContain("Say \"hi\"");
    });

    it("falls back to a neutral message for a page with no consent details", async () => {
        const markup = await renderDeletion(async () => ({ ok: true, json: async () => ({ renderedJson: { html: "<p>Hi</p>", css: "" } }) }));
        expect(markup).toContain(DEFAULT);
    });

    it("falls back to the neutral message when the page cannot be loaded", async () => {
        const markup = await renderDeletion(async () => {
            throw new Error("network down");
        });
        expect(markup).toContain(DEFAULT);
    });
});
