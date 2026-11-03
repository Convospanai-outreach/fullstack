import { describe, expect, it } from "vitest";
import { lintEmail } from "./editorialLinter";

describe("lintEmail", () => {
    it("passes plain writing that talks about the reader", () => {
        const result = lintEmail("Hi {first_name}, your team spends hours on this. You could get that time back. Want me to show you how?");
        expect(result).toMatchObject({ score: 100, passed: true, jargon: [], links: 0, findings: [] });
    });

    it("flags each jargon word and takes 15 points for it", () => {
        const result = lintEmail("Let's circle back and leverage your time. You and your team will love it, you will see.");
        expect(result.jargon).toEqual(["circle back", "leverage"]);
        expect(result.score).toBe(70);
        expect(result.passed).toBe(false);
    });

    it("flags a low you-to-we ratio with the counts", () => {
        const result = lintEmail("We built it. Our team loves it. We think you will too.");
        expect(result.youToWe).toBe(0.33);
        expect(result.score).toBe(80);
        expect(result.findings[0]).toContain('"you" 1 time');
    });

    it("does not judge the ratio when the text uses neither word", () => {
        expect(lintEmail("Short note about pricing.").youToWe).toBeNull();
        expect(lintEmail("Short note about pricing.").score).toBe(100);
    });

    it("counts distinct links across plain URLs and HTML anchors, and flags more than three", () => {
        const body = 'You and your team can <a href="https://a.example/x">see</a> https://b.example, https://c.example and https://d.example. Also https://a.example/x again.';
        const result = lintEmail(body);
        expect(result.links).toBe(4);
        expect(result.findings.join(" ")).toContain("4 links");
        expect(result.score).toBe(85);
    });

    it("ignores template tokens and HTML tags when counting words", () => {
        expect(lintEmail("<p>{your_company} sends you news</p>").youToWe).toBe(1);
    });

    it("never goes below zero", () => {
        const heavy = "synergy circle back leverage touch base utilize paradigm shift. We we we.";
        expect(lintEmail(heavy).score).toBe(0);
    });
});
