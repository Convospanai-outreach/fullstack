import { describe, expect, it } from "vitest";
import {
  decodeLeadFormMarkerId,
  encodeLeadFormMarkerId,
  instagramHandleProblem,
  instagramProfileUrl,
  isValidInstagramHandle,
  parseLeadFormConfig,
  type LeadFormConfig,
} from "./leadFormConfig";

const config: LeadFormConfig = {
  fields: [{ key: "email", label: "Work email", type: "email", required: true }],
  buttonLabel: "Send it to me",
  successMessage: "Thanks! Check your inbox.",
};

describe("instagram handle rules", () => {
  it.each(["brand", "my.brand_2", "A1", "x".repeat(30)])("accepts %s and builds its profile link", (handle) => {
    expect(isValidInstagramHandle(handle)).toBe(true);
    expect(instagramHandleProblem(handle)).toBeNull();
    expect(instagramProfileUrl(handle)).toBe(`https://www.instagram.com/${handle}/`);
  });

  it.each(["", "@brand", "x".repeat(31), "a/b", "../x", "x?y", "x#y", "bänd", "a b", "https://instagram.com/x"])(
    "rejects %j with a message and no link",
    (handle) => {
      expect(isValidInstagramHandle(handle)).toBe(false);
      expect(instagramProfileUrl(handle)).toBeNull();
      expect(instagramHandleProblem(handle)).toMatch(/Instagram handle/);
    }
  );

  it("rejects non-string values", () => {
    expect(isValidInstagramHandle(42)).toBe(false);
    expect(isValidInstagramHandle(null)).toBe(false);
    expect(instagramProfileUrl(undefined as unknown as string)).toBeNull();
  });

  it("the handle is an optional lead form setting", () => {
    expect(parseLeadFormConfig(config)).not.toBeNull();
    expect(parseLeadFormConfig({ ...config, instagramHandle: "brand" })?.instagramHandle).toBe("brand");
    expect(parseLeadFormConfig({ ...config, instagramHandle: "@brand" })).toBeNull();
  });

  it("the handle travels in the marker id, like the rest of the config", () => {
    const id = encodeLeadFormMarkerId({ ...config, instagramHandle: "brand" });
    expect(decodeLeadFormMarkerId(id)?.instagramHandle).toBe("brand");
  });
});
