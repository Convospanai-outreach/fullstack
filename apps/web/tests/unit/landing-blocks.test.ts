import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { EDITOR_BLOCKS } from "@/components/landing-agent/editorConfig";
import { INSTAGRAM_FOLLOW_CLASS, instagramBlockHref } from "@/components/landing-agent/instagramFollow";
import { LANDING_PAGE_BASE_CSS, getLandingRenderPayload } from "@/modules/landing-agent/rendering";

const FIXTURE = resolve(__dirname, "../fixtures/landing-blocks-markup.json");
const NEW_IDS = ["testimonial", "faq", "pricing", "image_text", "button", "divider", "instagram_follow"] as const;

function newBlock(id: string): string {
  const block = EDITOR_BLOCKS.find((b) => b.id === id);
  if (!block) throw new Error(`missing block ${id}`);
  return block.content;
}

// apps/api/src/modules/landing-agent/landingBlocksMarkup.test.ts runs this fixture through the real sanitizer.
// Set WRITE_BLOCKS_FIXTURE=1 to regenerate it from EDITOR_BLOCKS; otherwise a drift fails here.
const snapshot = { blocks: Object.fromEntries(NEW_IDS.map((id) => [id, newBlock(id)])) };
if (process.env["WRITE_BLOCKS_FIXTURE"] === "1") {
  writeFileSync(FIXTURE, `${JSON.stringify(snapshot, null, 2)}\n`);
}

// Void tags come back as <img ...> from the web copy and <img ... /> from the API copy; both are the same markup.
function normalize(html: string): string {
  return html.replace(/\s+/g, " ").replace(/\s*\/>/g, ">").replace(/> </g, "><").trim();
}

describe("new editor blocks", () => {
  it.each(NEW_IDS)("%s is in the block panel exactly once", (id) => {
    expect(EDITOR_BLOCKS.filter((b) => b.id === id)).toHaveLength(1);
  });

  it("the fixture matches the blocks (regenerate with WRITE_BLOCKS_FIXTURE=1)", () => {
    expect(existsSync(FIXTURE)).toBe(true);
    expect(JSON.parse(readFileSync(FIXTURE, "utf8"))).toEqual(snapshot);
  });

  it.each(NEW_IDS)("%s is a section and survives the web sanitizer unchanged", (id) => {
    const content = newBlock(id);
    expect(content.trim().startsWith("<section")).toBe(true);
    expect(normalize(getLandingRenderPayload({ html: content, css: "" }).html)).toBe(normalize(content));
  });

  it.each(NEW_IDS)("%s has no script, inline style, url(), form, button, input, hr or iframe", (id) => {
    expect(newBlock(id)).not.toMatch(/<script|\sstyle\s*=|url\(|<form|<button|<input|<hr|<iframe|\son[a-z]+\s*=/i);
  });

  it.each(NEW_IDS)("%s only links to the lead form or the Instagram profile link", (id) => {
    for (const tag of newBlock(id).match(/<a\b[^>]*>/gi) ?? []) {
      const href = /\shref="([^"]*)"/.exec(tag)?.[1];
      expect(href === "#lead-form" || /^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]{1,30}\/$/.test(href ?? "")).toBe(true);
    }
  });

  it.each(NEW_IDS)("%s uses only classes that the base CSS defines", (id) => {
    const classes = new Set<string>();
    for (const [, list] of newBlock(id).matchAll(/class="([^"]*)"/g)) {
      for (const cls of list!.split(/\s+/)) classes.add(cls);
    }
    for (const cls of classes) {
      expect(LANDING_PAGE_BASE_CSS).toContain(`.${cls}`);
    }
  });

  it("pricing has two or three plan cards", () => {
    const cards = newBlock("pricing").match(/class="la-plan"/g) ?? [];
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.length).toBeLessThanOrEqual(3);
  });

  it("faq has question and answer pairs", () => {
    const items = newBlock("faq").match(/class="la-faq-item"/g) ?? [];
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("the Instagram block links to a profile that the handle rules accept", () => {
    const placeholder = /href="https:\/\/www\.instagram\.com\/([^/]+)\/"/.exec(newBlock("instagram_follow"))?.[1];
    expect(instagramBlockHref(placeholder ?? "")).toHaveProperty("href");
    expect(newBlock("instagram_follow")).toContain(`class="la-cta ${INSTAGRAM_FOLLOW_CLASS}"`);
  });

  it("placeholder copy makes no numbers, results or scarcity claims", () => {
    for (const id of NEW_IDS) {
      const text = newBlock(id).replace(/<[^>]+>/g, " ");
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/guarantee|%|only|last chance|act now|results?|proven/i);
    }
  });
});
