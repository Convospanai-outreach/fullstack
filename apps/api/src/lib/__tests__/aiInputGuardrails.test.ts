import { describe, expect, it } from "vitest";
import { enforceAIPromptPolicy } from "../aiInputGuardrails";

describe("enforceAIPromptPolicy skipContentRules", () => {
    const pageLike = `Intro\n${"x".repeat(20_000)}\nWe test for XSS and CSRF. See https://a.com https://b.com https://c.com https://d.com https://e.com https://f.com`;

    it("rejects long or flagged text by default", () => {
        expect(() => enforceAIPromptPolicy(pageLike)).toThrow(/exceeds 6000/);
        expect(() => enforceAIPromptPolicy("We test for XSS and CSRF.")).toThrow();
        expect(() => enforceAIPromptPolicy("a https://a.com https://b.com https://c.com https://d.com https://e.com https://f.com")).toThrow(/Too many/);
    });

    it("allows page-like text up to the given size when content rules are skipped", () => {
        expect(enforceAIPromptPolicy(pageLike, { maxChars: 60_000, skipContentRules: true })).toContain("XSS");
    });

    it("still enforces the size cap when content rules are skipped", () => {
        expect(() => enforceAIPromptPolicy("y".repeat(60_001), { maxChars: 60_000, skipContentRules: true })).toThrow(/exceeds 60000/);
    });
});
