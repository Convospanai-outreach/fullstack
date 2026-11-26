import { describe, expect, it } from "vitest";
import { inboxProviderFromHost, isSpamFolder, placementToken, placementVerdict, type PlacementInboxResult } from "./inboxPlacementVerdict";

const pass = { dkim: "pass", signingDomain: "example.com", aligned: true, spf: "pass", dmarc: "pass" } as const;
const now = new Date("2026-11-25T10:00:00Z");
const fresh = new Date("2026-11-25T09:00:00Z");
const result = (provider: PlacementInboxResult["provider"], folder: PlacementInboxResult["folder"], auth = pass): PlacementInboxResult =>
    ({ inbox: `${provider}@test`, provider, folder, auth: folder === "missing" || folder === "error" ? null : { ...auth } });

describe("placementVerdict", () => {
    it("is green when two providers deliver to the inbox with passing authentication", () => {
        expect(placementVerdict([result("gmail", "inbox"), result("yahoo", "inbox")], fresh, now).level).toBe("green");
    });

    it("is red when any test inbox puts the email in spam", () => {
        const v = placementVerdict([result("gmail", "spam"), result("yahoo", "inbox")], fresh, now);
        expect(v.level).toBe("red");
        expect(v.reasons[0]).toMatch(/Gmail put the email in spam/);
    });

    it("is red when DMARC or the DKIM signature fails, even in the inbox", () => {
        expect(placementVerdict([result("gmail", "inbox", { ...pass, dmarc: "fail" }), result("yahoo", "inbox")], fresh, now).level).toBe("red");
        expect(placementVerdict([result("gmail", "inbox", { ...pass, dkim: "fail" }), result("yahoo", "inbox")], fresh, now).level).toBe("red");
    });

    it("is amber, not red, for a missing or third-party DKIM signature while DMARC passes", () => {
        const none = placementVerdict([result("gmail", "inbox", { ...pass, dkim: "none" }), result("yahoo", "inbox")], fresh, now);
        expect(none.level).toBe("amber");
        expect(none.reasons[0]).toMatch(/Set up DKIM/);
        expect(placementVerdict([result("gmail", "inbox", { ...pass, aligned: false }), result("yahoo", "inbox")], fresh, now).level).toBe("amber");
    });

    it("says when no copy arrived at all", () => {
        const v = placementVerdict([result("gmail", "missing"), result("yahoo", "missing")], fresh, now);
        expect(v).toMatchObject({ level: "amber", reasons: [expect.stringMatching(/None of the test copies arrived/)] });
    });

    it("is amber for Promotions, a copy that never arrived, an unreadable inbox, or a single provider", () => {
        expect(placementVerdict([result("gmail", "promotions"), result("yahoo", "inbox")], fresh, now).level).toBe("amber");
        expect(placementVerdict([result("gmail", "missing"), result("yahoo", "inbox")], fresh, now).level).toBe("amber");
        expect(placementVerdict([result("gmail", "error"), result("yahoo", "inbox")], fresh, now).level).toBe("amber");
        expect(placementVerdict([result("gmail", "inbox"), result("gmail", "inbox")], fresh, now).level).toBe("amber");
    });

    it("never blocks a mailbox that was not checked, or whose check is stale: those are amber", () => {
        expect(placementVerdict([], null, now).level).toBe("amber");
        const old = new Date("2026-11-01T00:00:00Z");
        expect(placementVerdict([result("gmail", "spam")], old, now).level).toBe("amber");
    });
});

describe("isSpamFolder", () => {
    it("uses the \\Junk special-use flag first, then common names", () => {
        expect(isSpamFolder({ path: "[Gmail]/Spam", specialUse: "\\Junk" })).toBe(true);
        expect(isSpamFolder({ path: "Bulk" })).toBe(true);
        expect(isSpamFolder({ path: "Junk E-mail" })).toBe(true);
        expect(isSpamFolder({ path: "INBOX" })).toBe(false);
        expect(isSpamFolder({ path: "[Gmail]/Sent Mail", specialUse: "\\Sent" })).toBe(false);
    });
});

describe("inboxProviderFromHost and placementToken", () => {
    it("recognises Gmail and Yahoo IMAP hosts", () => {
        expect(inboxProviderFromHost("imap.gmail.com")).toBe("gmail");
        expect(inboxProviderFromHost("imap.mail.yahoo.com")).toBe("yahoo");
        expect(inboxProviderFromHost("imap.zoho.com")).toBe("other");
        expect(inboxProviderFromHost("imap.fakeyahoo.com")).toBe("other");
        expect(inboxProviderFromHost("yahoo.com.example.net")).toBe("other");
    });

    it("makes a single searchable word", () => {
        expect(placementToken()).toMatch(/^ref[0-9a-f]{12}$/);
    });
});
