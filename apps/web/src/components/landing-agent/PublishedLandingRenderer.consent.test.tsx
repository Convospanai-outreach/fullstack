// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublishedLandingRenderer from "./PublishedLandingRenderer";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "@/modules/landing-agent/leadFormConfig";

const fixturesDir = resolve(__dirname, "../../../tests/fixtures");
const configs = JSON.parse(readFileSync(resolve(fixturesDir, "lead-form-config.json"), "utf8")) as { valid: Record<string, LeadFormConfig> };
const consentParity = JSON.parse(readFileSync(resolve(fixturesDir, "lead-form-consent-parity.json"), "utf8")) as Record<
  string,
  { controls: { name: string; tag: string; type: string; required: boolean; text: string }[]; consentText: string; links: { text: string; href: string }[] }
>;

const DELETION = "/p/guide/data-deletion";

function markerHtml(config: LeadFormConfig) {
  return `<section><h2>Headline</h2><div class="cmf-form" id="${encodeLeadFormMarkerId(config)}"></div></section>`;
}

describe("PublishedLandingRenderer consent box", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function render(config: LeadFormConfig) {
    await act(async () => {
      root.render(<PublishedLandingRenderer slug="guide" version={3} renderedJson={{ html: markerHtml(config), css: "" }} />);
    });
  }

  function leadCalls() {
    return fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/guide/lead"));
  }

  function submit() {
    const form = container.querySelector("form[data-cmf-form]") as HTMLFormElement;
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    return form;
  }

  it.each(Object.keys(consentParity))("%s shows the fixture's controls, consent text and links", async (name) => {
    await render(configs.valid[name]!);
    const want = consentParity[name]!;
    const controls = Array.from(container.querySelectorAll("form[data-cmf-form] input, form[data-cmf-form] select, form[data-cmf-form] textarea"))
      .filter((el) => (el as HTMLInputElement).name && !["website", "whatsappConsent"].includes((el as HTMLInputElement).name))
      .map((el) => ({
        name: (el as HTMLInputElement).name,
        tag: el.tagName.toLowerCase(),
        type: el.tagName.toLowerCase() === "input" ? (el as HTMLInputElement).type : el.tagName.toLowerCase(),
        required: (el as HTMLInputElement).required,
        text: el.getAttribute("aria-label") ?? "",
      }));
    expect(controls).toEqual(want.controls);
    const box = container.querySelector(".la-consent") as HTMLElement;
    expect(box.querySelector('input[name="cmfConsent"]')?.getAttribute("aria-label")).toBe(want.consentText);
    const links = Array.from(box.querySelectorAll("a")).map((a) => ({ text: a.textContent, href: a.getAttribute("href") }));
    expect(links).toEqual(want.links.map((l) => ({ text: l.text, href: l.href === "{deletion}" ? DELETION : l.href })));
  });

  it("opens the consent links in a new tab without opener access", async () => {
    await render(configs.valid["consent-full"]!);
    for (const link of Array.from(container.querySelectorAll(".la-consent a"))) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("starts unticked", async () => {
    await render(configs.valid["consent-default"]!);
    expect((container.querySelector('input[name="cmfConsent"]') as HTMLInputElement).checked).toBe(false);
  });

  it("blocks a required, unticked submit with a message and does not call the API", async () => {
    await render(configs.valid["consent-default"]!);
    (container.querySelector('input[name="email"]') as HTMLInputElement).value = "ada@example.com";
    submit();
    await act(async () => {
      await Promise.resolve();
    });
    expect(leadCalls()).toHaveLength(0);
    expect(container.querySelector("#la-consent-error")?.textContent).toMatch(/tick/i);
  });

  it("sends a ticked consent as a top-level flag, not as a form field", async () => {
    await render(configs.valid["consent-default"]!);
    (container.querySelector('input[name="email"]') as HTMLInputElement).value = "ada@example.com";
    (container.querySelector('input[name="cmfConsent"]') as HTMLInputElement).checked = true;
    submit();
    await act(async () => {
      await Promise.resolve();
    });
    expect(leadCalls()).toHaveLength(1);
    const body = JSON.parse(String((leadCalls()[0]![1] as RequestInit).body));
    expect(body.consent).toBe(true);
    expect(body.formFields).not.toHaveProperty("cmfConsent");
  });

  it("an optional, unticked consent still submits, with consent false", async () => {
    await render(configs.valid["consent-full"]!);
    (container.querySelector('input[name="email"]') as HTMLInputElement).value = "ada@example.com";
    submit();
    await act(async () => {
      await Promise.resolve();
    });
    expect(leadCalls()).toHaveLength(1);
    expect(JSON.parse(String((leadCalls()[0]![1] as RequestInit).body)).consent).toBe(false);
  });
});
