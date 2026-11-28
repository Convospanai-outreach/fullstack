import { describe, expect, it } from "vitest";
import { fitLinkedinText, LINKEDIN_LIMITS } from "./linkedinLength";

describe("fitLinkedinText", () => {
    it("uses LinkedIn's 300-character note and 600-character follow-up limits", () => {
        expect(LINKEDIN_LIMITS).toEqual({ connect: 300, followUp: 600 });
    });

    it("leaves text within the limit unchanged apart from trimming", () => {
        expect(fitLinkedinText("  Hi Asha, loved your talk.  ", "connect")).toBe("Hi Asha, loved your talk.");
    });

    it("cuts an over-long note at the last full sentence that fits", () => {
        const first = "Hi Asha, your piece on clinic scheduling was sharp, especially the part about no-shows and how your team rebuilt reminders around patient time zones rather than clinic hours. ";
        const text = first + "x".repeat(200) + " " + "y ".repeat(100);
        const fitted = fitLinkedinText(text, "connect");
        expect(fitted.length).toBeLessThanOrEqual(300);
        expect(fitted).toBe(first.trim());
    });

    it("falls back to the last whole word, never a broken word", () => {
        const text = "word ".repeat(80); // 400 chars, no sentence end
        const fitted = fitLinkedinText(text, "connect");
        expect(fitted.length).toBeLessThanOrEqual(300);
        expect(fitted.endsWith("word")).toBe(true);
        expect(fitted.split(" ").every(w => w === "word")).toBe(true);
    });

    it("prefers a whole word over a very short first sentence", () => {
        const text = "Hi. " + "Thanks for sharing the hiring update on your team page ".repeat(8);
        const fitted = fitLinkedinText(text, "connect");
        expect(fitted.length).toBeLessThanOrEqual(300);
        expect(fitted.length).toBeGreaterThan(200);
        expect(fitted).not.toMatch(/[,;:\-]$/);
    });

    it("hard-cuts a single unbroken token so the limit always holds", () => {
        expect(fitLinkedinText("a".repeat(700), "followUp")).toHaveLength(600);
    });

    it("applies the 600 limit to follow-ups", () => {
        const text = "This is one sentence of a follow-up. ".repeat(30);
        const fitted = fitLinkedinText(text, "followUp");
        expect(fitted.length).toBeLessThanOrEqual(600);
        expect(fitted.endsWith(".")).toBe(true);
    });
});
