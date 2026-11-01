import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { LeadFormConfig } from "./leadFormConfig";
import { buildLeadFormHtml } from "./leadFormHtml";
import { buildFullDocument } from "./service/cloudflarePagesService";

const WEB = resolve(__dirname, "../../../../web");
const configs = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/lead-form-config.json"), "utf8")) as {
  valid: Record<string, LeadFormConfig>;
};
const consentParity = JSON.parse(readFileSync(resolve(WEB, "tests/fixtures/lead-form-consent-parity.json"), "utf8")) as Record<
  string,
  { controls: Control[]; consentText: string; links: { text: string; href: string }[] }
>;

interface Control {
  name: string;
  tag: string;
  type: string;
  required: boolean;
  text: string;
}

// Same reader as leadFormHtml.test.ts, so the controls are compared the same way.
function describeControls(html: string): Control[] {
  const out: Control[] = [];
  const pattern = /<(input|textarea|select)\b([^>]*?)\/?>/g;
  const attr = (attrs: string, name: string) => new RegExp(`(?:^|\s)${name}="([^"]*)"`).exec(attrs)?.[1];
  for (const match of html.matchAll(pattern)) {
    const tag = match[1]!;
    const attrs = match[2]!;
    const name = attr(attrs, "name");
    if (!name || name === "website" || name === "whatsappConsent") continue;
    out.push({
      name,
      tag,
      type: tag === "input" ? (attr(attrs, "type") ?? "text") : tag,
      required: /(?:^|\s)required(?=\s|\/|$)/.test(attrs),
      text: attr(attrs, "aria-label") ?? "",
    });
  }
  return out;
}

// The consent line: the checkbox's accessible text and the links inside it.
function describeConsent(html: string) {
  const box = /<div class="la-consent"[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
  const checkbox = /<input type="checkbox" name="cmfConsent" aria-label="([^"]*)"/.exec(box);
  return {
    consentText: checkbox?.[1] ?? null,
    links: [...box.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => ({ text: m[2]!, href: m[1]! })),
  };
}

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

describe("forms without a consent block are byte-identical to before", () => {
  it("the full form hashes as before", () => {
    expect(sha(buildLeadFormHtml(configs.valid["full"]!, { slug: "guide" }))).toBe(
      "45617b217d4311ee36fba4ea4803df978584250b2711b2e351b2c458e52343ca"
    );
  });

  it("the email-only form with the WhatsApp opt-in hashes as before", () => {
    expect(sha(buildLeadFormHtml(configs.valid["email-only"]!, { slug: "guide", whatsappOptIn: "x" }))).toBe(
      "2d4615205c11f7a1efcb250ce064c465ede13ff4435e29a323b737ba4e7df481"
    );
  });

  it("a page with no form (fixed box) document hashes as before", () => {
    const doc = buildFullDocument({ title: "T", css: "", html: "<p>Hi</p>", script: "var a=1;", whatsappOptIn: null, slug: "guide", theme: null });
    expect(sha(doc)).toBe("fa504a1552e34fa3866a9ef1c2bc3f68fee7c4cba713d17decd974e65ce6444e");
  });

  it("a consent block that is switched off renders the same form as a config without one", () => {
    const withOff = configs.valid["consent-disabled"]!;
    const without = { ...withOff, consent: undefined } as LeadFormConfig;
    expect(buildLeadFormHtml(withOff, { slug: "guide" })).not.toBe("");
    expect(buildLeadFormHtml(withOff, { slug: "guide" })).toBe(buildLeadFormHtml(without, { slug: "guide" }));
    expect(buildLeadFormHtml(withOff, { slug: "guide" })).not.toContain("cmfConsent");
  });
});

describe("consent markup matches the shared parity fixture", () => {
  it.each(Object.keys(consentParity))("%s has the fixture's controls, consent text and links", (name) => {
    const want = consentParity[name]!;
    const html = buildLeadFormHtml(configs.valid[name]!, { slug: "guide" });
    expect(describeControls(html)).toEqual(want.controls);
    expect(describeConsent(html)).toEqual({
      consentText: want.consentText,
      links: want.links.map((link) => ({ text: link.text, href: link.href === "{deletion}" ? "/guide/data-deletion" : link.href })),
    });
  });

  it("links to the data-deletion address the caller gives (the app passes its /p address)", () => {
    const html = buildLeadFormHtml(configs.valid["consent-default"]!, { slug: "guide", deletionHref: "/p/guide/data-deletion" });
    expect(describeConsent(html).links).toEqual([{ text: "Data deletion", href: "/p/guide/data-deletion" }]);
  });
});

describe("consent markup behaviour", () => {
  it("the checkbox is unchecked by default and marked required for assistive tech", () => {
    const html = buildLeadFormHtml(configs.valid["consent-default"]!, { slug: "guide" });
    expect(html).not.toMatch(/name="cmfConsent"[^>]*\schecked/);
    expect(html).toMatch(/name="cmfConsent"[^>]*aria-required="true"/);
    expect(html).toContain('id="la-consent-error"');
    expect(html).toContain('role="alert"');
  });

  it("does not mark an optional consent as required", () => {
    const html = buildLeadFormHtml(configs.valid["consent-full"]!, { slug: "guide" });
    expect(html).not.toMatch(/name="cmfConsent"[^>]*aria-required/);
  });

  it("opens the links in a new tab without opener access", () => {
    const html = buildLeadFormHtml(configs.valid["consent-full"]!, { slug: "guide" });
    const links = html.match(/<a [^>]*>/g) ?? [];
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toContain('target="_blank" rel="noopener noreferrer"');
  });

  it("escapes the consent wording and the link addresses", () => {
    const config = {
      ...configs.valid["consent-full"]!,
      consent: {
        enabled: true,
        text: `Say "hi" & 'bye'`,
        privacyUrl: `https://example.com/p?x="y`,
        deletionUrl: `https://example.com/d?x="y`,
      },
    } as LeadFormConfig;
    const html = buildLeadFormHtml(config, { slug: "guide" });
    expect(html).toContain("Say &quot;hi&quot; &amp; &#39;bye&#39;");
    expect(html).not.toContain('x="y');
    expect(html).toContain("x=&quot;y");
  });
});
