// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublishedLandingRenderer from "./PublishedLandingRenderer";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "@/modules/landing-agent/leadFormConfig";

const fixturesDir = resolve(__dirname, "../../../tests/fixtures");
const configs = JSON.parse(readFileSync(resolve(fixturesDir, "lead-form-config.json"), "utf8")) as {
  valid: Record<string, LeadFormConfig>;
};
const parity = JSON.parse(readFileSync(resolve(fixturesDir, "lead-form-parity.json"), "utf8")) as Record<string, unknown[]>;

const full = configs.valid["full"] as LeadFormConfig;
const markerHtml = `<section><h2>Headline</h2><div class="cmf-form" id="${encodeLeadFormMarkerId(full)}"></div></section>`;

function renderedJson(html: string) {
  return { html, css: "" };
}

describe("PublishedLandingRenderer lead form", () => {
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

  async function render(html: string, extra: { whatsappOptIn?: string | null } = {}) {
    await act(async () => {
      root.render(<PublishedLandingRenderer slug="guide" version={3} renderedJson={renderedJson(html)} {...extra} />);
    });
  }

  it("a page without a marker still shows the fixed follow-up box", async () => {
    await render("<p>Hi</p>");
    expect(container.textContent).toContain("Request a follow-up");
    expect(container.querySelector("#la-lead-form")).toBeNull();
    expect(container.querySelector('input[name="website"]')).not.toBeNull();
    expect(container.querySelector("[data-cmf-form]")).toBeNull();
  });

  it("a page with a marker shows its form where the marker was, and no fixed box", async () => {
    await render(markerHtml);
    expect(container.textContent).not.toContain("Request a follow-up");
    const form = container.querySelector("form[data-cmf-form]");
    expect(form).not.toBeNull();
    expect(container.querySelector("h2")?.textContent).toBe("Headline");
    expect(form?.getAttribute("data-redirect")).toBe("https://example.com/thanks");
    expect(container.querySelector("button[type=submit]")?.textContent).toBe("Get my plan");
  });

  it("the rendered controls match the shared parity fixture", async () => {
    await render(markerHtml);
    const form = container.querySelector("form[data-cmf-form]") as HTMLFormElement;
    const names = Array.from(form.querySelectorAll("input, select, textarea"))
      .map((el) => (el as HTMLInputElement).name)
      .filter((n) => n && n !== "website");
    expect(names).toEqual((parity["full"] as Array<{ name: string }>).map((c) => c.name));
  });

  it("reports form_start on the first focus inside the marker form", async () => {
    await render(markerHtml);
    const input = container.querySelector('input[name="email"]') as HTMLInputElement;
    await act(async () => {
      input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    const bodies = fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));
    expect(bodies.some((url) => url.endsWith("/landing-agent/public/guide/event"))).toBe(true);
  });

  it("submits custom fields as formFields and nothing else from the fixed box", async () => {
    await render(markerHtml);
    const form = container.querySelector("form[data-cmf-form]") as HTMLFormElement;
    (form.querySelector('input[name="name"]') as HTMLInputElement).value = "Ada";
    (form.querySelector('input[name="email"]') as HTMLInputElement).value = "ada@example.com";
    (form.querySelector('select[name="budget"]') as HTMLSelectElement).value = "$1k-$5k";
    (form.querySelector('input[name="consent"]') as HTMLInputElement).checked = true;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const leadCall = fetchMock.mock.calls.find((call) => String((call as unknown[])[0]).endsWith("/landing-agent/public/guide/lead"));
    expect(leadCall).toBeDefined();
    const body = JSON.parse(((leadCall as unknown[])[1] as { body: string }).body);
    expect(body.formFields).toEqual({
      name: "Ada",
      email: "ada@example.com",
      phone: "",
      company: "",
      title: "",
      goal: "",
      budget: "$1k-$5k",
      consent: true,
    });
    expect(body.email).toBeUndefined();
    expect(body.pageVersion).toBe(3);
  });
});
