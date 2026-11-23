import { describe, expect, it } from "vitest";
import { aiTellsForCritic, scanAiTells, stripEmDashes } from "./aiTells";

describe("scanAiTells", () => {
    it("scores plain human text as clean", () => {
        const r = scanAiTells("Saw your team posted three ops roles in Pune last week. Is hiring outpacing the facilities side? Worth a quick call on Thursday?");
        expect(r.band).toBe("Clean");
    });

    it("catches stock words, phrases, structures and em dashes", () => {
        const text = "I hope this email finds you well. In today's fast-paced world, it's important to note that our robust platform helps you leverage AI — not just to save time, but to delve into a tapestry of insights.";
        const r = scanAiTells(text);
        const labels = r.hits.map((h) => h.label.toLowerCase()).join(" | ");
        expect(r.score).toBeGreaterThan(40);
        expect(labels).toContain("delve");
        expect(labels).toContain("tapestry");
        expect(r.hits.some((h) => h.category === "punctuation")).toBe(true);
        expect(r.hits.some((h) => h.category === "structures")).toBe(true);
    });

    it("ignores words inside links and email addresses", () => {
        const r = scanAiTells("See https://example.com/delve-tapestry or write to delve@example.com today.");
        expect(r.hits.filter((h) => h.category === "words")).toHaveLength(0);
    });

    it("skips literal uses (navigate the website)", () => {
        const r = scanAiTells("You can navigate the website menu to find pricing.");
        expect(r.hits.some((h) => h.label === "navigate")).toBe(false);
    });
});

describe("helpers", () => {
    it("lists hits for the critic, empty when clean", () => {
        expect(aiTellsForCritic("Thanks, see you Thursday.")).toBe("");
        expect(aiTellsForCritic("Let's delve into this tapestry.")).toContain("Rewrite these");
    });
    it("removes em dashes", () => {
        expect(stripEmDashes("We saw the post — great work")).toBe("We saw the post, great work");
        expect(stripEmDashes("Fast setup — Zero lock-in")).toBe("Fast setup. Zero lock-in");
    });
});
