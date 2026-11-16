import { describe, expect, it } from "vitest";
import { findHoldbacks, type HoldbackInput } from "./draftHoldbacks";

const base: HoldbackInput = {
    subject: "Your webinar",
    body: "Hi Ann, loved your talk on pipeline hygiene. Worth a quick chat? See https://acme.com/book",
    ownedHosts: ["acme.com"],
    protectedTexts: [],
    knownContacts: { emails: ["ann@example.com", "me@acme.com"], phones: ["+1 (415) 555-0100"] },
};
const codes = (input: Partial<HoldbackInput>) => findHoldbacks({ ...base, ...input }).map((r) => r.code);

const PROMPT = "You write B2B cold emails that feel like they came from a brilliant peer not a vendor. The prospect must feel within the first sentence that you read something specific they did or said.";

describe("findHoldbacks", () => {
    it("lets a clean draft through", () => {
        expect(findHoldbacks(base)).toEqual([]);
    });

    it("holds a link to a host the team does not own, including a disguised one", () => {
        expect(codes({ body: "Details at https://evil.com/x" })).toEqual(["FOREIGN_LINK"]);
        expect(codes({ body: "Details at evil[.]com" })).toEqual(["FOREIGN_LINK"]);
        expect(codes({ body: "Details at http://3232235777/" })).toEqual(["FOREIGN_LINK"]);
    });

    it("holds an unreadable link", () => {
        expect(codes({ body: '<a href="javascript:x">here</a>' })).toEqual(["FOREIGN_LINK"]);
    });

    it("holds every link when the team owns no host yet", () => {
        expect(codes({ ownedHosts: [] })).toEqual(["FOREIGN_LINK"]);
    });

    it("checks the subject too", () => {
        expect(codes({ subject: "see evil.com" })).toEqual(["FOREIGN_LINK"]);
    });

    it("holds a draft that repeats a 12-word run of the prompt", () => {
        const leak = "Sure! feel like they came from a brilliant peer not a vendor. The prospect must feel within";
        expect(codes({ body: `Hi Ann. ${leak}`, protectedTexts: [PROMPT] })).toEqual(["INSTRUCTION_LEAK"]);
    });

    it("ignores case and punctuation when matching the run", () => {
        const leak = "FEEL LIKE THEY CAME FROM A BRILLIANT PEER, NOT A VENDOR; the prospect must feel within";
        expect(codes({ body: leak, protectedTexts: [PROMPT] })).toContain("INSTRUCTION_LEAK");
    });

    it("does not hold on a run of 11 words", () => {
        const eleven = "feel like they came from a brilliant peer not a vendor";
        expect(eleven.split(" ")).toHaveLength(11);
        expect(codes({ body: `Hi Ann, ${eleven}.`, protectedTexts: [PROMPT] })).toEqual([]);
    });

    it("holds a phone number or email that is not in the lead facts or the sender profile", () => {
        expect(codes({ body: "Call me on +44 20 7946 0958." })).toEqual(["FOREIGN_CONTACT"]);
        expect(codes({ body: "Or write to boss@elsewhere.org." })).toEqual(["FOREIGN_CONTACT"]);
    });

    it("lets through the lead's own and the sender's own contact details, in any format", () => {
        expect(codes({ body: "Reply to me@acme.com or ring 415-555-0100." })).toEqual([]);
        expect(codes({ body: "Is ANN@example.com still right?" })).toEqual([]);
    });

    it("does not mistake dates or short numbers for a phone number", () => {
        expect(codes({ body: "Webinar on 2026-11-15 at 10:00, 1,200 seats, $4,500." })).toEqual([]);
    });

    it("reports every problem, each with a readable message", () => {
        const r = findHoldbacks({ ...base, body: "evil.com or +44 20 7946 0958", protectedTexts: [] });
        expect(r.map((x) => x.code)).toEqual(["FOREIGN_LINK", "FOREIGN_CONTACT"]);
        expect(r.every((x) => x.message.length > 10)).toBe(true);
    });
});
