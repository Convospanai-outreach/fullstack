import { describe, expect, it } from "vitest";
import { EDITOR_BLOCKS } from "@/components/landing-agent/editorConfig";
import { LANDING_PAGE_BASE_CSS } from "@/modules/landing-agent/rendering";
import { INSTAGRAM_FOLLOW_CLASS, instagramBlockHref, instagramFollowBlockContent, instagramFollowOfSelection } from "./instagramFollow";
import { LEAD_FORM_DEFAULT_CONFIG, setLeadFormSetting } from "./leadFormEditor";

describe("instagram follow block", () => {
  it("builds the link only from a validated handle", () => {
    expect(instagramBlockHref("brand")).toEqual({ href: "https://www.instagram.com/brand/" });
  });

  it("rejects an invalid handle with a message and no href", () => {
    const result = instagramBlockHref("@brand");
    expect(result).not.toHaveProperty("href");
    expect(result).toHaveProperty("problem");
    expect((result as { problem: string }).problem).toMatch(/Instagram handle/);
  });

  it("the block is an in-page section with the follow button class", () => {
    const content = instagramFollowBlockContent();
    expect(content).toContain(`class="la-cta ${INSTAGRAM_FOLLOW_CLASS}"`);
    expect(content).toContain('href="https://www.instagram.com/yourhandle/"');
    expect(EDITOR_BLOCKS.find((b) => b.id === "instagram_follow")?.content).toBe(content);
  });

  it("recognises a selected follow button by its class only", () => {
    expect(instagramFollowOfSelection(["la-cta", INSTAGRAM_FOLLOW_CLASS])).toBe(true);
    expect(instagramFollowOfSelection(["la-cta"])).toBe(false);
  });

  it("the follow button class has a rule in the base CSS", () => {
    expect(LANDING_PAGE_BASE_CSS).toContain(`.la-cta.${INSTAGRAM_FOLLOW_CLASS}`);
  });
});

describe("lead form thank-you handle setting", () => {
  it("setting a handle stores it on the form config", () => {
    expect(setLeadFormSetting(LEAD_FORM_DEFAULT_CONFIG, { instagramHandle: "brand" }).instagramHandle).toBe("brand");
  });

  it("an empty handle removes it, as an empty redirect does", () => {
    const withHandle = setLeadFormSetting(LEAD_FORM_DEFAULT_CONFIG, { instagramHandle: "brand" });
    expect(setLeadFormSetting(withHandle, { instagramHandle: "" })).not.toHaveProperty("instagramHandle");
  });
});
