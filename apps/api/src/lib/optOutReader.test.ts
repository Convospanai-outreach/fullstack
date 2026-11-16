import { describe, expect, it } from "vitest";
import { readOptOut } from "./optOutReader";

type Case = [label: string, text: string, expected: string | null];

const CASES: Case[] = [
    // Words that look like opt-outs but are not
    ["remove a slide", "Can you remove the pricing slide from the deck?", null],
    ["stopped by", "I stopped by your booth last week, great demo.", null],
    ["non-stop", "Sounds good, a non-stop week for us, call me Friday.", null],
    ["stop in a sentence", "We should stop by the office on Tuesday.", null],
    ["please stop by", "Please stop by our office on Tuesday.", null],
    ["remove my name from the deck", "Please remove my name from the deck, I left that project.", null],
    // Clear opt-outs
    ["please stop", "Please stop.", "OPT_OUT"],
    ["bare STOP", "STOP", "OPT_OUT"],
    ["stop with a full stop", "stop.", "OPT_OUT"],
    ["unsubscribe me", "Please unsubscribe me", "OPT_OUT"],
    ["stop emailing", "Stop emailing me.", "OPT_OUT"],
    ["remove me", "Remove me from your list.", "OPT_OUT"],
    ["take me off", "Please take me off this.", "OPT_OUT"],
    ["do not contact", "Do not contact me again.", "OPT_OUT"],
    ["opt out wins over not interested", "Not interested, please remove me from your list", "OPT_OUT"],
    // Softer answers do not suppress
    ["not interested", "Not interested, thanks", "NOT_INTERESTED"],
    ["not now", "Not right now, try in Q3", "NOT_NOW"],
    ["follow up later", "Can you follow up next month?", "NOT_NOW"],
    // Auto-replies are never opt-outs, even when they use opt-out words
    ["out of office", "I am out of office until Monday. For urgent requests, remove the ticket and call.", "AUTO_REPLY"],
    ["automatic reply", "Automatic reply: I stop checking mail on leave.", "AUTO_REPLY"],
    // We cannot read these: a human must look
    ["hinglish", "mujhe mat bhejo", "UNSURE"],
    ["devanagari", "मुझे ईमेल मत भेजो", "UNSURE"],
    // Normal replies are left for the model pass
    ["interested", "Sounds interesting, can we talk Thursday?", null],
    ["question", "How does pricing work for 5 seats?", null],
];

describe("readOptOut deterministic pass", () => {
    it.each(CASES)("%s", (_label, text, expected) => {
        expect(readOptOut({ body: text })?.class ?? null).toBe(expected);
    });

    it("ignores the quoted copy of our own email with its unsubscribe footer", () => {
        const body = "Thanks, will review.\n\nOn Mon, 3 Nov 2026 at 10:00, Sam <sam@x.com> wrote:\n> Hi\n> Click here to unsubscribe";
        expect(readOptOut({ body })).toBeNull();
        expect(readOptOut({ body: "Thanks!\n> unsubscribe\n> stop" })).toBeNull();
        expect(readOptOut({ body: "Thanks.\n-----Original Message-----\nIf you want to stop, unsubscribe here" })).toBeNull();
    });

    it("reports which pass decided and never echoes the message", () => {
        const r = readOptOut({ body: "Please unsubscribe me" });
        expect(r).toEqual({ class: "OPT_OUT", pass: "deterministic" });
    });

    it("treats auto-reply headers as an auto-reply", () => {
        expect(readOptOut({ body: "hello", headers: { "Auto-Submitted": "auto-replied" } })?.class).toBe("AUTO_REPLY");
        expect(readOptOut({ body: "hello", headers: { "x-autoreply": "yes" } })?.class).toBe("AUTO_REPLY");
        expect(readOptOut({ body: "hello", headers: { precedence: "bulk" } })?.class).toBe("AUTO_REPLY");
        expect(readOptOut({ body: "hello", headers: { "auto-submitted": "no" } })).toBeNull();
    });

    it("auto-reply headers beat opt-out words", () => {
        expect(readOptOut({ body: "unsubscribe", headers: { "Auto-Submitted": "auto-generated" } })?.class).toBe("AUTO_REPLY");
    });
});
