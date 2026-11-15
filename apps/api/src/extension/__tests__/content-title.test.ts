// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Runs the shipped content.js to check how it reads names out of LinkedIn's page title.
const source = fs.readFileSync(path.resolve(__dirname, "..", "content.js"), "utf8");

function loadContentScript() {
    const chrome = { runtime: { sendMessage: () => undefined, onMessage: { addListener: () => undefined }, lastError: undefined } };
    return new Function("chrome", `${source}\nreturn { stripLinkedInBadges, parseLinkedInTitle };`)(chrome) as {
        stripLinkedInBadges: (value: string) => string;
        parseLinkedInTitle: (value: string) => { name: string; headline: string };
    };
}

describe("content script: LinkedIn page title", () => {
    const { stripLinkedInBadges, parseLinkedInTitle } = loadContentScript();

    it("drops the unread count in front of the title", () => {
        expect(stripLinkedInBadges("(1) Jane Doe | LinkedIn")).toBe("Jane Doe");
        expect(stripLinkedInBadges("(12+) Jane Doe | LinkedIn")).toBe("Jane Doe");
        expect(parseLinkedInTitle("(3) Jane Doe - Founder at Acme | LinkedIn")).toEqual({ name: "Jane Doe", headline: "Founder at Acme" });
    });

    it("leaves a title without a count as it was", () => {
        expect(stripLinkedInBadges("Jane Doe | LinkedIn")).toBe("Jane Doe");
        expect(parseLinkedInTitle("Jane Doe | LinkedIn")).toEqual({ name: "Jane Doe", headline: "" });
        expect(stripLinkedInBadges("Jane (JD) Doe")).toBe("Jane (JD) Doe");
        expect(stripLinkedInBadges("(3) Founder at Acme")).toBe("(3) Founder at Acme");
    });
});
