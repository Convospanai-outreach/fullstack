import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LANDING_PAGE_BASE_CSS, sanitizeRenderedJsonHtml } from "./rendering";

// The editor's new blocks live in apps/web; its test writes the exact markup to this fixture.
// Here every block goes through the real API sanitizer and must come back unchanged.
const WEB = resolve(__dirname, "../../../../web");
const fixture = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/landing-blocks-markup.json"), "utf8")) as {
  blocks: Record<string, string>;
};

function sanitize(html: string): string {
  return (sanitizeRenderedJsonHtml({ html, css: "" }) as { html: string }).html;
}

function normalize(html: string): string {
  return html.replace(/\s+/g, " ").replace(/> </g, "><").trim();
}

describe("editor blocks through the sanitizer", () => {
  it.each(Object.entries(fixture.blocks))("%s survives the sanitizer unchanged", (_name, html) => {
    expect(normalize(sanitize(html))).toBe(normalize(html));
  });

  it.each(Object.entries(fixture.blocks))("%s contains no script, inline style or url()", (_name, html) => {
    expect(sanitize(html)).not.toMatch(/<script|\sstyle\s*=|url\(/i);
  });

  it("the new classes are defined in the API copy of the base CSS", () => {
    for (const cls of ["la-faq-item", "la-pricing", "la-plan", "la-image-text", "la-divider", "la-testimonial", "la-instagram"]) {
      expect(LANDING_PAGE_BASE_CSS).toMatch(new RegExp(`\\.${cls}\\b`));
    }
  });

  it("the web copy of the lead form config is identical to the API copy", () => {
    const api = readFileSync(resolve(__dirname, "leadFormConfig.ts"), "utf8").replace(/\r\n/g, "\n");
    const webCopy = readFileSync(resolve(WEB, "src/modules/landing-agent/leadFormConfig.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(api).toBe(webCopy);
  });
});
