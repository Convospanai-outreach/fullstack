import { describe, expect, it } from "vitest";
import { normalizeLinkedInProfileUrl } from "./linkedinUrl";

describe("normalizeLinkedInProfileUrl", () => {
    it("accepts linkedin.com and its subdomains", () => {
        expect(normalizeLinkedInProfileUrl("https://www.linkedin.com/in/jane")).toBe("https://www.linkedin.com/in/jane");
        expect(normalizeLinkedInProfileUrl("https://linkedin.com/in/jane")).toBe("https://linkedin.com/in/jane");
    });

    it.each([
        "https://linkedin.com.evil.example/in/jane",
        "https://notlinkedin.com/in/jane",
        "https://evil.example/?u=linkedin.com",
        "https://evil.example/linkedin.com",
        "javascript:alert(1)",
        "not a url",
    ])("rejects %s", (url) => {
        expect(() => normalizeLinkedInProfileUrl(url)).toThrow("Invalid LinkedIn profile URL");
    });

    it("only allows http(s)", () => {
        expect(() => normalizeLinkedInProfileUrl("ftp://linkedin.com/in/jane")).toThrow("Invalid LinkedIn profile URL");
    });
});
