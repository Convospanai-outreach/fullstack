import { describe, expect, it } from "vitest";
import {
  isValidCompany,
  parseTitleMetaFallback,
  stripLinkedInBadges
} from "../visible-profile-capture";

describe("visible profile capture helpers", () => {
  it("parses title and meta fallback without guessing unavailable headline", () => {
    expect(parseTitleMetaFallback({ title: "Jane Doe | LinkedIn" })).toEqual({
      name: "Jane Doe",
      headline: ""
    });
  });

  it("uses safe title/meta headline fallback", () => {
    expect(parseTitleMetaFallback({
      ogTitle: "Jane Doe - Founder at CraftMyFunnel | LinkedIn",
      metaDescription: "View Jane Doe's profile on LinkedIn"
    })).toEqual({
      name: "Jane Doe",
      headline: "Founder at CraftMyFunnel"
    });
  });

  it("strips connection badges", () => {
    expect(stripLinkedInBadges("Jane Doe · 1st")).toBe("Jane Doe");
    expect(stripLinkedInBadges("Founder 2nd degree connection")).toBe("Founder");
  });

  it("rejects education and locations as companies", () => {
    expect(isValidCompany("Delhi University")).toBe(false);
    expect(isValidCompany("Bengaluru, India")).toBe(false);
    expect(isValidCompany("CraftMyFunnel")).toBe(true);
  });
});
