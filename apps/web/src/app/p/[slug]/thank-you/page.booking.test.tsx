import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "@/modules/landing-agent/leadFormConfig";
import LandingThankYouPage from "./page";

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

describe("thank-you page booking button", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a Book a call button to the saved https link", async () => {
    const markup = await renderThankYou(configWith({ bookingUrl: "https://cal.example.com/team/intro?x=1" }));
    expect(markup).toContain('href="https://cal.example.com/team/intro?x=1"');
    expect(markup).toContain("Book a call");
  });

  it("has no booking button when the form has no link", async () => {
    const markup = await renderThankYou(configWith({}));
    expect(markup).not.toContain("Book a call");
  });
});
