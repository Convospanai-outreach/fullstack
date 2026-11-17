import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "@/modules/landing-agent/leadFormConfig";
import LandingThankYouPage from "./page";

const DEFAULT_MESSAGE = "A team member will follow up shortly with next steps.";

function configWith(extra: Record<string, unknown>) {
  return {
    fields: [{ key: "email", label: "Work email", type: "email", required: true }],
    buttonLabel: "Send it to me",
    successMessage: "Thanks! Check your inbox.",
    ...extra,
  } as LeadFormConfig;
}

async function renderThankYou(config: LeadFormConfig) {
  const html = `<section><div class="cmf-form" id="${encodeLeadFormMarkerId(config)}"></div></section>`;
  vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ renderedJson: { html, css: "" } }) }));
  const element = await LandingThankYouPage({ params: Promise.resolve({ slug: "guide" }) });
  return renderToStaticMarkup(element);
}

describe("thank-you page follow button", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a Follow us on Instagram button to the validated profile", async () => {
    const markup = await renderThankYou(configWith({ instagramHandle: "guide.shop" }));
    expect(markup).toContain('href="https://www.instagram.com/guide.shop/"');
    expect(markup).toContain("Follow us on Instagram");
    expect(markup).toContain("Thanks! Check your inbox.");
  });

  it("has no follow button when the form has no handle", async () => {
    const markup = await renderThankYou(configWith({}));
    expect(markup).not.toContain("instagram.com");
    expect(markup).toContain("Thanks! Check your inbox.");
  });

  it("falls back to today's text and no button when the page has no form", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ renderedJson: { html: "<p>Hi</p>", css: "" } }) }));
    const markup = renderToStaticMarkup(await LandingThankYouPage({ params: Promise.resolve({ slug: "guide" }) }));
    expect(markup).toContain(DEFAULT_MESSAGE);
    expect(markup).not.toContain("instagram.com");
  });
});
