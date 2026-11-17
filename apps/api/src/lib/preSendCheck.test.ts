import { describe, expect, it } from "vitest";
import { DEFAULT_SEND_SAFETY, preSendCheck, resolveSendSafety, type PreSendInput } from "./preSendCheck";

const healthy: PreSendInput = {
    to: "sam@acme.example",
    subject: "Quick question about Acme's onboarding",
    body: "<p>Hi Sam,</p><p>I noticed Acme is hiring two support leads. We help teams like yours cut first-response time. Worth a short call next week? Details: <a href=\"https://craftmyfunnel.live/demo\">demo</a></p>",
    kind: "sequence",
    settings: DEFAULT_SEND_SAFETY,
    postalAddress: "1 Main St, Pune",
};
const codes = (over: Partial<PreSendInput>) => preSendCheck({ ...healthy, ...over }).reasons.map((r) => r.code);

describe("preSendCheck", () => {
    it("lets a normal healthy email through untouched", () => {
        expect(preSendCheck(healthy)).toEqual({ ok: true, reasons: [] });
    });

    it.each<[string, Partial<PreSendInput>, string]>([
        ["malformed recipient", { to: "not-an-email" }, "BAD_RECIPIENT"],
        ["empty subject", { subject: "   " }, "EMPTY_SUBJECT"],
        ["long subject", { subject: "x".repeat(200) }, "LONG_SUBJECT"],
        ["empty body", { body: "<p> </p>" }, "EMPTY_BODY"],
        ["long body", { body: "word ".repeat(450) }, "LONG_BODY"],
        ["unrendered token", { body: "<p>Hi {{firstName}}, quick note.</p>" }, "UNRENDERED_TOKEN"],
        ["banned phrase", { body: "<p>Act now, this is a risk-free offer.</p>" }, "BANNED_PHRASE"],
        ["AI tell", { body: "<p>I hope this email finds you well.</p>" }, "BANNED_PHRASE"],
        ["two links", { body: '<p><a href="https://a.example/x">a</a> and <a href="https://b.example/y">b</a></p>' }, "TOO_MANY_LINKS"],
        ["no postal address on file", { postalAddress: "" }, "NO_POSTAL_ADDRESS"],
    ])("%s", (_l, over, code) => {
        expect(codes(over)).toContain(code);
    });

    it("counts bare URLs in plain text as links too", () => {
        expect(codes({ body: "See https://a.example and https://b.example" })).toContain("TOO_MANY_LINKS");
    });

    it("ignores mailto and tel links in the budget", () => {
        expect(codes({ body: '<a href="mailto:a@b.co">mail</a> <a href="tel:+911234">call</a> <a href="https://craftmyfunnel.live">x</a>' })).not.toContain("TOO_MANY_LINKS");
    });

    it("holds links to a domain outside the allowed set, and allows subdomains of allowed ones", () => {
        const settings = resolveSendSafety({ allowedLinkHosts: ["craftmyfunnel.live"] });
        expect(codes({ settings, body: '<a href="https://evil.example/x">x</a>' })).toContain("FOREIGN_LINK");
        expect(codes({ settings, body: '<a href="https://www.craftmyfunnel.live/x">x</a>' })).not.toContain("FOREIGN_LINK");
        expect(codes({ settings, body: '<a href="https://craftmyfunnel.live.evil.example/x">x</a>' })).toContain("FOREIGN_LINK");
    });

    it("reads unquoted and single-quoted href values too", () => {
        const settings = resolveSendSafety({ allowedLinkHosts: ["craftmyfunnel.live"] });
        expect(codes({ settings, body: "<a href=https://evil.example/x>x</a>" })).toContain("FOREIGN_LINK");
        expect(codes({ settings, body: "<a href='https://evil.example/x'>x</a>" })).toContain("FOREIGN_LINK");
        expect(codes({ settings, body: "<a href=https://craftmyfunnel.live/x>x</a>" })).not.toContain("FOREIGN_LINK");
    });

    it("does not restrict link domains when none are configured", () => {
        expect(codes({ body: '<a href="https://anything.example/x">x</a>' })).not.toContain("FOREIGN_LINK");
    });

    it("in plain-text mode rejects raw HTML tags", () => {
        const settings = resolveSendSafety({ plainTextOnly: true });
        expect(codes({ settings, body: "Hi <b>Sam</b>" })).toContain("HTML_IN_PLAIN_TEXT");
        expect(codes({ settings, body: "Hi Sam, a < b and 3 > 2" })).not.toContain("HTML_IN_PLAIN_TEXT");
    });

    it("replies skip the cold-only checks but keep the rest", () => {
        const body = '<a href="https://a.example/x">a</a> <a href="https://b.example/y">b</a>';
        const reply = codes({ kind: "reply", body, postalAddress: null });
        expect(reply).not.toContain("TOO_MANY_LINKS");
        expect(reply).not.toContain("NO_POSTAL_ADDRESS");
        expect(codes({ kind: "reply", to: "bad" })).toContain("BAD_RECIPIENT");
    });

    it("uses the team's own phrase list when set", () => {
        const settings = resolveSendSafety({ bannedPhrases: ["synergy"] });
        expect(codes({ settings, body: "<p>Let us discuss synergy.</p>" })).toContain("BANNED_PHRASE");
        expect(codes({ settings, body: "<p>Act now, risk-free.</p>" })).not.toContain("BANNED_PHRASE");
    });

    it("does not match a banned phrase inside a longer word", () => {
        const settings = resolveSendSafety({ bannedPhrases: ["act now"] });
        expect(codes({ settings, body: "<p>We react nowadays quickly.</p>" })).not.toContain("BANNED_PHRASE");
    });
});

describe("resolveSendSafety", () => {
    it("defaults to warn mode and lenient limits", () => {
        const s = resolveSendSafety(null);
        expect(s.mode).toBe("warn");
        expect(s.maxLinks).toBe(1);
    });
    it("keeps valid overrides and ignores junk", () => {
        const s = resolveSendSafety({ mode: "hold", maxLinks: 3, maxSubjectChars: "lots", bannedPhrases: ["a", 5, ""], plainTextOnly: "yes" });
        expect(s.mode).toBe("hold");
        expect(s.maxLinks).toBe(3);
        expect(s.maxSubjectChars).toBe(DEFAULT_SEND_SAFETY.maxSubjectChars);
        expect(s.bannedPhrases).toEqual(["a"]);
        expect(s.plainTextOnly).toBe(false);
    });
    it("falls back to warn for an unknown mode", () => {
        expect(resolveSendSafety({ mode: "banana" }).mode).toBe("warn");
    });
});

describe("preSendCheck email status", () => {
    it.each(["GUESS", "UNKNOWN"])("holds a cold send to a %s address", (emailStatus) => {
        expect(codes({ emailStatus })).toEqual(["EMAIL_NOT_VERIFIED"]);
    });

    it("never allows a cold send to an INVALID address", () => {
        expect(codes({ emailStatus: "INVALID" })).toEqual(["EMAIL_INVALID"]);
    });

    it("allows a cold send to a VERIFIED address, and to a lead with no status recorded", () => {
        expect(codes({ emailStatus: "VERIFIED" })).toEqual([]);
        expect(codes({ emailStatus: null })).toEqual([]);
    });

    it("allows RISKY only when the team allows it", () => {
        expect(codes({ emailStatus: "RISKY" })).toEqual(["EMAIL_NOT_VERIFIED"]);
        expect(codes({ emailStatus: "RISKY", settings: { ...DEFAULT_SEND_SAFETY, allowRiskyEmail: true } })).toEqual([]);
    });

    it("exempts replies, because the person wrote to us", () => {
        expect(codes({ kind: "reply", emailStatus: "INVALID" })).toEqual([]);
        expect(codes({ kind: "reply", emailStatus: "UNKNOWN" })).toEqual([]);
    });

    it("reads the team setting as true only when it is exactly true", () => {
        expect(resolveSendSafety({ allowRiskyEmail: true }).allowRiskyEmail).toBe(true);
        expect(resolveSendSafety({ allowRiskyEmail: "yes" }).allowRiskyEmail).toBe(false);
        expect(resolveSendSafety(null).allowRiskyEmail).toBe(false);
    });
});
