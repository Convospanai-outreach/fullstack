import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "./leadFormConfig";
import { buildLeadFormHtml, findLeadFormMarkers, hasLeadFormMarker, readLeadFormConfig, replaceLeadFormMarkers } from "./leadFormHtml";
import { getLandingRenderPayload } from "./rendering";

const fixturesDir = resolve(__dirname, "../../../tests/fixtures");
const configs = JSON.parse(readFileSync(resolve(fixturesDir, "lead-form-config.json"), "utf8")) as {
  valid: Record<string, LeadFormConfig>;
  invalid: Record<string, LeadFormConfig>;
};
const parity = JSON.parse(readFileSync(resolve(fixturesDir, "lead-form-parity.json"), "utf8")) as Record<string, Control[]>;

interface Control {
  name: string;
  tag: string;
  type: string;
  required: boolean;
  text: string;
  options?: string[];
}

// Reads the controls back out of the HTML. The API test uses the same logic on its output.
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
const marker = `<div class="cmf-form" id="${encodeLeadFormMarkerId(sample)}"></div>`;

describe("lead form HTML parity with the shared fixture", () => {
  it.each(Object.keys(parity))("%s has the fixture's controls", (name) => {
    expect(describeControls(buildLeadFormHtml(configs.valid[name] as LeadFormConfig, { slug: "s" }))).toEqual(parity[name]);
  });

  it("returns nothing for an invalid config", () => {
    expect(buildLeadFormHtml(configs.invalid["redirect-javascript"] as LeadFormConfig, { slug: "s" })).toBe("");
  });

  it("escapes hostile label, option and button text", () => {
    const hostile = `"><img src=x onerror=alert(1)><script>alert(2)</script>`;
    const config = {
      fields: [
        { key: "email", label: hostile, type: "email", required: true },
        { key: "budget", label: "Budget", type: "select", required: false, options: [hostile] },
      ],
      buttonLabel: "Go",
      successMessage: "Thanks",
    } as LeadFormConfig;
    const html = buildLeadFormHtml(config, { slug: "s", whatsappOptIn: hostile });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain(hostile);
  });
});

describe("marker handling", () => {
  it("the first marker wins and later ones are dropped", () => {
    const out = replaceLeadFormMarkers(`${marker}<p>x</p>${marker}`, { slug: "s" });
    expect(out.match(/data-cmf-form/g)).toHaveLength(1);
    expect(out).not.toContain(encodeLeadFormMarkerId(sample));
  });

  it("a page with no marker is unchanged", () => {
    const html = "<p>Hello</p>";
    expect(hasLeadFormMarker(html)).toBe(false);
    expect(replaceLeadFormMarkers(html, { slug: "s" })).toBe(html);
  });

  it("finds the config of the first marker", () => {
    expect(readLeadFormConfig(marker)).toEqual(sample);
    expect(findLeadFormMarkers(`<div class="card"></div>${marker}`)).toHaveLength(1);
  });

  it("the marker survives the web's own render path with its id intact", () => {
    const payload = getLandingRenderPayload({ html: `<section>${marker}</section>`, css: "" });
    expect(readLeadFormConfig(payload.html)).toEqual(sample);
  });
});
