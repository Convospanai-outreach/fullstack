import { describe, it, expect } from "vitest";
import { renderMergeTags } from "@/lib/email/mergeTags";
import { pickWeightedVariant } from "@/lib/email/campaignVariants";
import { buildUnsubscribeUrl, buildUnsubscribeHeaders, appendUnsubscribeFooter } from "@/lib/email/unsubscribeHeaders";

describe("renderMergeTags", () => {
  it("substitutes known tags from lead fields", () => {
    const result = renderMergeTags("Hi {{firstName}} from {{company}}", {
      fullName: "Ada Lovelace",
      company: "Analytical Engines Inc",
      email: "ada@example.com",
      jobTitle: "Engineer",
    });
    expect(result).toBe("Hi Ada from Analytical Engines Inc");
  });

  it("leaves unknown tags untouched", () => {
    const result = renderMergeTags("Hi {{firstName}}, {{unknownTag}}", { fullName: "Bob" });
    expect(result).toBe("Hi Bob, {{unknownTag}}");
  });

  it("substitutes with empty string when lead field is missing", () => {
    const result = renderMergeTags("Hi {{firstName}} at {{company}}", {});
    expect(result).toBe("Hi  at ");
  });

  it("derives lastName from a multi-word fullName", () => {
    const result = renderMergeTags("{{firstName}} {{lastName}}", { fullName: "Grace Brewster Hopper" });
    expect(result).toBe("Grace Brewster Hopper");
  });
});

describe("pickWeightedVariant", () => {
  it("returns null for an empty list", () => {
    expect(pickWeightedVariant([])).toBeNull();
  });

  it("always returns the only variant when there's one", () => {
    const variant = { id: "v1", subject: "S", body: "B", weight: 50 };
    expect(pickWeightedVariant([variant])).toEqual(variant);
  });

  it("only ever returns weight-0 variants when all weights are 0 (falls back to uniform pick)", () => {
    const variants = [
      { id: "v1", subject: "S1", body: "B1", weight: 0 },
      { id: "v2", subject: "S2", body: "B2", weight: 0 },
    ];
    for (let i = 0; i < 20; i++) {
      const picked = pickWeightedVariant(variants);
      expect(["v1", "v2"]).toContain(picked?.id);
    }
  });

  it("never picks a variant with weight 0 when another has positive weight", () => {
    const variants = [
      { id: "always", subject: "S1", body: "B1", weight: 100 },
      { id: "never", subject: "S2", body: "B2", weight: 0 },
    ];
    for (let i = 0; i < 50; i++) {
      expect(pickWeightedVariant(variants)?.id).toBe("always");
    }
  });
});

describe("unsubscribe helpers", () => {
  it("builds a stable unsubscribe URL containing the tracking id", () => {
    const url = buildUnsubscribeUrl("track-123");
    expect(url).toContain("/api/email/unsubscribe/track-123");
  });

  it("builds RFC 8058 one-click headers", () => {
    const headers = buildUnsubscribeHeaders("track-123");
    expect(headers["List-Unsubscribe"]).toContain("track-123");
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("appends a visible unsubscribe footer to the html body", () => {
    const html = appendUnsubscribeFooter("<p>Hello</p>", "track-123");
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain("track-123");
    expect(html.toLowerCase()).toContain("unsubscribe");
  });
});
