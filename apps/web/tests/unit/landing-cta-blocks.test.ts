import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { CTA_BLOCKS, CTA_MICRO_COPY, CTA_PRESET_TEXTS } from "@/components/landing-agent/ctaBlocks";
import { LANDING_PAGE_BASE_CSS } from "@/modules/landing-agent/rendering";

const FIXTURE = resolve(__dirname, "../fixtures/cta-markup.json");

// apps/api/src/modules/landing-agent/ctaMarkup.test.ts runs this fixture through the real sanitizer.
// Set WRITE_CTA_FIXTURE=1 to regenerate it from CTA_BLOCKS; otherwise a drift fails here.
const snapshot = { presets: [...CTA_PRESET_TEXTS], microCopy: CTA_MICRO_COPY, blocks: Object.fromEntries(CTA_BLOCKS.map((b) => [b.id, b.content])) };
if (process.env["WRITE_CTA_FIXTURE"] === "1") {
  writeFileSync(FIXTURE, `${JSON.stringify(snapshot, null, 2)}\n`);
}

const CTA_CLASSES = ["la-cta-outline", "la-cta-mobile-full", "la-cta-wrap", "la-cta-micro", "la-cta-sticky"];

describe("CTA block library", () => {
  it("has the seven presets from the spec", () => {
    expect([...CTA_PRESET_TEXTS]).toEqual([
      "Get the free guide",
      "Send it to my DMs",
      "Yes, show me how",
      "Reserve my seat",
      "Claim the offer",
      "Book my free call",
      "Show me the checklist",
    ]);
  });

  it("has a solid block for every preset plus the four variants and the honest end-of-offer block", () => {
    const ids = CTA_BLOCKS.map((b) => b.id);
    expect(ids.filter((id) => id.startsWith("cta_preset_"))).toHaveLength(7);
    for (const id of ["cta_outline", "cta_mobile_full", "cta_micro_copy", "cta_sticky_bar", "offer_end_date"]) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every button is an a.la-cta to the in-page form, with no inline style or script", () => {
    for (const block of CTA_BLOCKS) {
      expect(block.content).not.toMatch(/\sstyle\s*=/i);
      expect(block.content).not.toMatch(/<script/i);
      for (const tag of block.content.match(/<a\b[^>]*>/gi) ?? []) {
        expect(tag).toMatch(/class="la-cta[ "]/);
        expect(tag).toMatch(/href="#lead-form"/);
      }
    }
  });

  it("sticky bar is a class only: no script, no inline style, no url()", () => {
    const sticky = CTA_BLOCKS.find((b) => b.id === "cta_sticky_bar")!;
    expect(sticky.content).toContain('class="la-cta-sticky"');
    expect(sticky.content).not.toMatch(/<script|\sstyle\s*=|url\(/i);
  });

  it("the micro-copy block carries the exact line", () => {
    expect(CTA_MICRO_COPY).toBe("No spam. Unsubscribe any time.");
    expect(CTA_BLOCKS.find((b) => b.id === "cta_micro_copy")!.content).toContain(`<p class="la-cta-micro">${CTA_MICRO_COPY}</p>`);
  });

  it("the end-of-offer block is plain editable text with no countdown and no scarcity wording", () => {
    const block = CTA_BLOCKS.find((b) => b.id === "offer_end_date")!;
    expect(block.content).toBe("<p>Offer ends [date]</p>");
    expect(block.label).toContain("Only use this if it is true.");
  });

  it("every CTA class is used by a block and defined in the base CSS", () => {
    const used = new Set(CTA_BLOCKS.flatMap((b) => [...b.content.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1]!.split(" "))));
    for (const cls of CTA_CLASSES) {
      expect(used.has(cls)).toBe(true);
      expect(LANDING_PAGE_BASE_CSS).toContain(`.${cls} {`);
    }
  });

  it("the markup fixture the sanitizer test reads matches the blocks (drift check)", () => {
    expect(existsSync(FIXTURE)).toBe(true);
    expect(JSON.parse(readFileSync(FIXTURE, "utf8"))).toEqual(JSON.parse(JSON.stringify(snapshot)));
  });
});
