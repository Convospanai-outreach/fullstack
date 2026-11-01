import { describe, expect, it } from "vitest";
import { pageLink, shownDomain, validatePagePath } from "./landingPageAddress";

describe("validatePagePath", () => {
    it.each([
        ["spring-guide", "spring-guide"],
        ["  Spring-Guide  ", "spring-guide"],
        ["go2", "go2"],
        ["a".repeat(63), "a".repeat(63)],
    ])("accepts %j as %j", (input, expected) => {
        expect(validatePagePath(input)).toEqual({ ok: true, path: expected });
    });

    it.each([
        ["an empty path", ""],
        ["a single character", "a"],
        ["64 characters", "a".repeat(64)],
        ["a leading hyphen", "-guide"],
        ["an underscore", "spring_guide"],
        ["a space inside", "spring guide"],
        ["a slash", "spring/guide"],
        ["non-ascii letters", "über"],
    ])("rejects %s", (_label, input) => {
        const result = validatePagePath(input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/2 to 63 letters, numbers or hyphens/);
    });
});

describe("pageLink", () => {
    it("builds the address on an apex domain", () => {
        expect(pageLink("yourbrand.com", "spring-guide")).toBe("https://yourbrand.com/spring-guide");
    });

    it("builds the address on a www domain", () => {
        expect(pageLink("www.yourbrand.com", "spring-guide")).toBe("https://www.yourbrand.com/spring-guide");
    });

    it("builds the address on a subdomain such as go.yourbrand.com", () => {
        expect(pageLink("go.yourbrand.com", "spring-guide")).toBe("https://go.yourbrand.com/spring-guide");
    });

    it("falls back to the app's own /p address when the team has no active domain", () => {
        expect(pageLink(null, "spring-guide")).toBe("/p/spring-guide");
        expect(pageLink(undefined, "spring-guide")).toBe("/p/spring-guide");
    });
});

describe("shownDomain", () => {
    const domains = ["yourbrand.com", "go.yourbrand.com"];

    it("shows the preferred domain when it is one of the team's domains", () => {
        expect(shownDomain(domains, "go.yourbrand.com")).toBe("go.yourbrand.com");
    });

    it("shows the first domain when the preferred one is not in the list", () => {
        expect(shownDomain(domains, "other.example.com")).toBe("yourbrand.com");
    });

    it("shows the first domain when there is no preference", () => {
        expect(shownDomain(domains, null)).toBe("yourbrand.com");
    });

    it("returns null when the team has no active domain", () => {
        expect(shownDomain([], "yourbrand.com")).toBeNull();
    });
});
