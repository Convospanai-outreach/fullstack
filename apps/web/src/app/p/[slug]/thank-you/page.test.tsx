import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "@/modules/landing-agent/leadFormConfig";
import LandingThankYouPage from "./page";

const config = {
    fields: [{ key: "email", label: "Work email", type: "email", required: true }],
    buttonLabel: "Send it to me",
    successMessage: "Thanks! Check your inbox.",
} as LeadFormConfig;

async function renderThankYou(fetchImpl: () => Promise<unknown>) {
    vi.stubGlobal("fetch", fetchImpl);
    const element = await LandingThankYouPage({ params: Promise.resolve({ slug: "guide" }) });
    return renderToStaticMarkup(element);
}

describe("thank-you page shows the form's success message", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("shows the success message of the form the page was submitted from", async () => {
        const html = `<section><div class="cmf-form" id="${encodeLeadFormMarkerId(config)}"></div></section>`;
        const markup = await renderThankYou(async () => ({ ok: true, json: async () => ({ renderedJson: { html, css: "" } }) }));
        expect(markup).toContain("Thanks! Check your inbox.");
        expect(markup).not.toContain("A team member will follow up");
    });

    it("falls back to the current text for a page without a form", async () => {
        const markup = await renderThankYou(async () => ({ ok: true, json: async () => ({ renderedJson: { html: "<p>Hi</p>", css: "" } }) }));
        expect(markup).toContain("A team member will follow up shortly with next steps.");
    });

    it("falls back to the current text when the page cannot be loaded", async () => {
        const markup = await renderThankYou(async () => {
            throw new Error("network down");
        });
        expect(markup).toContain("A team member will follow up shortly with next steps.");
    });
});
