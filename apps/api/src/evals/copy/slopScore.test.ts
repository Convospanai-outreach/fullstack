import { describe, expect, it } from "vitest";
import { parseExtraPhrases, scoreSlop } from "./slopScore";

const clean = {
    subject: "Your Tuesday onboarding drop-off",
    body: "Priya, your signup flow loses most people at step three. We fixed the same thing at Acme in two weeks. Worth a 15 minute look?",
};

describe("scoreSlop", () => {
    it("gives a plain, specific message a zero score", () => {
        const r = scoreSlop(clean);
        expect(r.score).toBe(0);
        expect(r.hits).toEqual([]);
    });

    it("flags stock opener and closer phrases, case-insensitively", () => {
        const r = scoreSlop({ subject: "Hi", body: "I hope this email finds you well. I wanted to reach out because we are a game-changer. Let's TOUCH BASE." });
        const rules = r.hits.map((h) => h.rule);
        expect(rules).toContain("stock-phrase");
        expect(r.hits.filter((h) => h.rule === "stock-phrase").map((h) => h.match.toLowerCase())).toEqual(
            expect.arrayContaining(["i hope this email finds you well", "i wanted to reach out", "game-changer", "touch base"]),
        );
        expect(r.score).toBeGreaterThan(40);
    });

    it("flags em dashes, 'not just X but Y', and exclamation marks", () => {
        const r = scoreSlop({ subject: "Quick idea", body: "We are not just a tool, but a partner — and it works! Really!" });
        const rules = r.hits.map((h) => h.rule);
        expect(rules).toEqual(expect.arrayContaining(["em-dash", "not-just-but", "exclamation"]));
    });

    it("only counts a stock phrase on word boundaries", () => {
        expect(scoreSlop({ subject: "s", body: "Our delivery team leveraged nothing." }).hits.map((h) => h.match.toLowerCase())).not.toContain("leverage");
        expect(scoreSlop({ subject: "s", body: "We leverage your data." }).hits.map((h) => h.match.toLowerCase())).toContain("leverage");
    });

    it("flags a bloated body", () => {
        const body = Array.from({ length: 200 }, () => "word").join(" ");
        expect(scoreSlop({ subject: "s", body }).hits.map((h) => h.rule)).toContain("too-long");
    });

    it("caps the score at 100", () => {
        const body = "I hope this finds you well. ".repeat(30);
        expect(scoreSlop({ subject: "s", body }).score).toBe(100);
    });

    it("uses extra private phrases when given", () => {
        const r = scoreSlop({ subject: "s", body: "We are best-in-class." }, { extraPhrases: ["best-in-class"] });
        expect(r.hits.map((h) => h.match.toLowerCase())).toContain("best-in-class");
    });
});

describe("parseExtraPhrases", () => {
    it("accepts a JSON array of strings and trims blanks", () => {
        expect(parseExtraPhrases(["  a b ", "c"])).toEqual(["a b", "c"]);
    });
    it("rejects anything that is not an array of non-empty strings", () => {
        expect(() => parseExtraPhrases({})).toThrow(/array/);
        expect(() => parseExtraPhrases([1])).toThrow(/string/);
        expect(() => parseExtraPhrases([""])).toThrow(/string/);
    });
});
