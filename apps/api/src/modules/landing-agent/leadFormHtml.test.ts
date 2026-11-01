import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildLeadFormHtml,
  findLeadFormMarkers,
  hasLeadFormMarker,
  leadFormSuccessUrl,
  readLeadFormConfig,
  replaceLeadFormMarkers,
} from "./leadFormHtml";
import { encodeLeadFormMarkerId, parseLeadFormConfig, type LeadFormConfig } from "./leadFormConfig";
import { sanitizeRenderedJsonHtml } from "./rendering";

const WEB = resolve(__dirname, "../../../../web");
const configs = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/lead-form-config.json"), "utf8")) as {
  valid: Record<string, LeadFormConfig>;
  invalid: Record<string, LeadFormConfig>;
};
const parity = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/lead-form-parity.json"), "utf8")) as Record<
  string,
  Control[]
>;

interface Control {
  name: string;
  tag: string;
  type: string;
  required: boolean;
  text: string;
  options?: string[];
}

// Reads the controls back out of the HTML. The web test uses the same logic on the React output.
function describeControls(html: string): Control[] {
  const out: Control[] = [];
  const pattern = /<(input|textarea|select)\b([^>]*?)\/?>/g;
  const attr = (attrs: string, name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
  for (const match of html.matchAll(pattern)) {
    const tag = match[1];
    const attrs = match[2];
    const start = match.index ?? 0;
    const name = attr(attrs, "name");
    if (!name || name === "website" || name === "whatsappConsent") continue;
    const type = tag === "input" ? (attr(attrs, "type") ?? "text") : tag;
    const entry: Control = {
      name,
      tag,
      type,
      required: /(?:^|\s)required(?=\s|\/|$)/.test(attrs),
      text: attr(attrs, "aria-label") ?? "",
    };
    if (tag === "select") {
      const body = html.slice(start, html.indexOf("</select>", start));
      entry.options = [...body.matchAll(/<option value="([^"]+)"/g)].map((o) => o[1]);
    }
    out.push(entry);
  }
  return out;
}

const sample = configs.valid["full"] as LeadFormConfig;

describe("lead form HTML parity with the shared fixture", () => {
  it.each(Object.keys(parity))("%s has the fixture's controls", (name) => {
    expect(describeControls(buildLeadFormHtml(configs.valid[name] as LeadFormConfig, { slug: "s" }))).toEqual(parity[name]);
  });

  it("the web copies of the shared modules are byte-identical to these", () => {
    for (const file of ["leadFormConfig.ts", "leadFormHtml.ts"]) {
      expect(readFileSync(resolve(WEB, "src/modules/landing-agent", file), "utf8")).toBe(
        readFileSync(resolve(__dirname, file), "utf8")
      );
    }
  });

  it("adds the honeypot, the WhatsApp consent box only when asked, and the redirect as an attribute", () => {
    const plain = buildLeadFormHtml(sample, { slug: "s" });
    expect(plain).toContain(`name="website"`);
    expect(plain).not.toContain("whatsappConsent");
    expect(plain).toContain(`data-redirect="https://example.com/thanks"`);
    expect(buildLeadFormHtml(sample, { slug: "s", whatsappOptIn: "Text me" })).toContain(`name="whatsappConsent"`);
  });

  it("shows the WhatsApp consent only when the form has a phone field", () => {
    const noPhone = { fields: [{ key: "email", label: "Email", type: "email", required: true }], buttonLabel: "Go", successMessage: "Thanks" } as LeadFormConfig;
    expect(buildLeadFormHtml(noPhone, { slug: "s", whatsappOptIn: "Text me" })).not.toContain("whatsappConsent");
    expect(buildLeadFormHtml(sample, { slug: "s", whatsappOptIn: "Text me" })).toContain("whatsappConsent");
  });

  it("sends a submitted form to its redirect link, else to the page's thank-you page", () => {
    expect(leadFormSuccessUrl("https://example.com/thanks", "guide")).toBe("https://example.com/thanks");
    expect(leadFormSuccessUrl(null, "guide")).toBe("/p/guide/thank-you");
    expect(leadFormSuccessUrl("", "guide")).toBe("/p/guide/thank-you");
  });

  it("returns nothing for an invalid config", () => {
    expect(buildLeadFormHtml(configs.invalid["nine-fields"] as LeadFormConfig, { slug: "s" })).toBe("");
  });
});

describe("lead form config text is escaped, never raw markup", () => {
  it("escapes script, img and attribute-breaking text in a valid config", () => {
    const hostile = `"><img src=x onerror=alert(1)><script>alert(2)</script>`;
    const config = {
      fields: [
        { key: "email", label: hostile, type: "email", required: true },
        { key: "budget", label: hostile, type: "select", required: false, options: [hostile] },
        { key: "consent", label: hostile, type: "checkbox", required: false },
      ],
      buttonLabel: "\"><img onerror=1>",
      successMessage: hostile,
    } as LeadFormConfig;
    expect(parseLeadFormConfig(config)).not.toBeNull();
    const html = buildLeadFormHtml(config, { slug: "s", whatsappOptIn: hostile });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain(hostile);
    expect(html).toContain("&quot;&gt;&lt;img src=x onerror=alert(1)&gt;&lt;script&gt;");
  });
});

describe("markers in page HTML", () => {
  const marker = `<div class="cmf-form" id="${encodeLeadFormMarkerId(sample)}"></div>`;

  it("finds markers with the attributes in either order and ignores other divs", () => {
    const reversed = `<div id="${encodeLeadFormMarkerId(sample)}" class="cmf-form"></div>`;
    expect(findLeadFormMarkers(`<div class="card"></div>${reversed}`)).toHaveLength(1);
    expect(hasLeadFormMarker(`<div class="cmf-form"></div>`)).toBe(false);
  });

  it("a page with no marker is returned unchanged", () => {
    const html = `<section><p>Hello</p></section>`;
    expect(replaceLeadFormMarkers(html, { slug: "s" })).toBe(html);
    expect(readLeadFormConfig(html)).toBeNull();
  });

  it("replaces the first marker only, and drops later markers", () => {
    const out = replaceLeadFormMarkers(`${marker}<p>x</p>${marker}`, { slug: "s" });
    expect(out.match(/data-cmf-form/g)).toHaveLength(1);
    expect(out).toContain("<p>x</p>");
    expect(out).not.toContain(encodeLeadFormMarkerId(sample));
  });

  it("an invalid first marker renders nothing and a later valid one does not take its place", () => {
    const bad = `<div class="cmf-form" id="cmf-form-bm90LWpzb24"></div>`;
    const out = replaceLeadFormMarkers(`<p>a</p>${bad}${marker}`, { slug: "s" });
    expect(out).toBe("<p>a</p>");
  });

  it("survives the real sanitizer in the API", () => {
    const html = (sanitizeRenderedJsonHtml({ html: `<section>${marker}</section>`, css: "" }) as { html: string }).html;
    expect(readLeadFormConfig(html)).toEqual(sample);
  });
});
