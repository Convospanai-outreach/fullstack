import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeRenderedJsonHtml } from "./rendering";
import {
  decodeLeadFormMarkerId,
  encodeLeadFormMarkerId,
  parseLeadFormConfig,
  type LeadFormConfig,
} from "./leadFormConfig";

// Shared with apps/web: the web copy of this module is tested against the same fixture.
const WEB = resolve(__dirname, "../../../../web");
const fixture = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/lead-form-config.json"), "utf8")) as {
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
};

function sanitize(html: string): string {
  return (sanitizeRenderedJsonHtml({ html, css: "" }) as { html: string }).html;
}

describe("lead form config (shared fixture)", () => {
  it.each(Object.keys(fixture.valid))("accepts %s", (name) => {
    expect(parseLeadFormConfig(fixture.valid[name])).not.toBeNull();
  });

  it.each(Object.keys(fixture.invalid))("rejects %s", (name) => {
    expect(parseLeadFormConfig(fixture.invalid[name])).toBeNull();
  });
});

describe("lead form marker through the real sanitizer", () => {
  const config = fixture.valid["full"] as LeadFormConfig;
  const id = encodeLeadFormMarkerId(config);

  it("keeps a valid marker with its class and id", () => {
    const out = sanitize(`<section><div class="cmf-form" id="${id}"></div></section>`);
    expect(out).toContain(`class="cmf-form"`);
    expect(out).toContain(`id="${id}"`);
    expect(decodeLeadFormMarkerId(id)).toEqual(config);
  });

  it("drops event handlers and javascript: links next to a marker", () => {
    const out = sanitize(
      `<div class="cmf-form" id="${id}" onclick="alert(1)"></div><a href="javascript:alert(1)">x</a>`
    );
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("javascript:");
    expect(out).toContain(`id="${id}"`);
  });

  it("still removes customer form, input, button, iframe and script tags", () => {
    const out = sanitize(
      `<form action="/x"><input name="a"><button>go</button></form><iframe src="https://example.com"></iframe><script>alert(1)</script><p>keep</p>`
    );
    for (const tag of ["<form", "<input", "<button", "<iframe", "<script"]) expect(out).not.toContain(tag);
    expect(out).toContain("<p>keep</p>");
  });

  it("a payload hidden in the id cannot carry a javascript: redirect past the validator", () => {
    const bad = Buffer.from(JSON.stringify({ ...config, redirectUrl: "javascript:alert(1)" })).toString("base64url");
    const out = sanitize(`<div class="cmf-form" id="cmf-form-${bad}"></div>`);
    expect(out).toContain(`id="cmf-form-${bad}"`);
    expect(decodeLeadFormMarkerId(`cmf-form-${bad}`)).toBeNull();
  });

});
