import { describe, expect, it } from "vitest";
import { hostAllowed, linkHostsIn } from "./linkHosts";

// Every row is a way to write a link that a plain "https?://" scan would miss. `null` means the
// link could not be read, which callers must treat as foreign.
const rows: [string, string, (string | null)[]][] = [
    ["scheme url", "see https://Evil.com/path?q=1", ["evil.com"]],
    ["www prefix dropped", "http://www.evil.com", ["evil.com"]],
    ["bare domain", "visit evil.com today", ["evil.com"]],
    ["bare domain with path", "go to evil.com/offer now", ["evil.com"]],
    ["bracket dot", "visit evil[.]com", ["evil.com"]],
    ["paren dot", "visit evil(.)com", ["evil.com"]],
    ["word dot", "visit evil dot com", ["evil.com"]],
    ["bracketed word dot", "visit evil[dot]com", ["evil.com"]],
    ["spaced dot", "visit evil . com", ["evil.com"]],
    ["zero-width characters", "visit ev​il.co‍m", ["evil.com"]],
    ["soft hyphen", "visit ev­il.com", ["evil.com"]],
    ["punycode", "https://xn--e1afmkfd.xn--p1ai/x", ["xn--e1afmkfd.xn--p1ai"]],
    ["unicode lookalike becomes punycode", "visit еvil.com", ["xn--vil-qdd.com"]],
    ["ipv4", "open http://192.168.0.1/login", ["192.168.0.1"]],
    ["bare ipv4", "open 10.0.0.5/login", ["10.0.0.5"]],
    ["decimal ipv4", "open http://3232235777/", ["192.168.1.1"]],
    ["href attribute", '<a href="https://evil.com">click</a>', ["evil.com"]],
    ["href with obfuscated text", '<a href="evil dot com">x</a>', ["evil.com"]],
    ["javascript url is unreadable", '<a href="javascript:alert(1)">x</a>', [null]],
    ["unparseable scheme url is unreadable", "see http://[bad/", [null]],
    ["email addresses are not links", "write to ann@example.com", []],
    ["plain prose is not a link", "We met at Acme Inc. Then we talked. e.g. later.", []],
    ["a version number is not a link", "we ship v2.0.1 soon", []],
];

describe("linkHostsIn", () => {
    it.each(rows)("%s", (_name, text, expected) => {
        expect(linkHostsIn(text)).toEqual(expected);
    });

    it("lists each link once per occurrence", () => {
        expect(linkHostsIn("a.com and https://b.com and a.com").sort()).toEqual(["a.com", "a.com", "b.com"]);
    });
});

describe("hostAllowed", () => {
    it("matches the host and its subdomains only", () => {
        expect(hostAllowed("acme.com", ["acme.com"])).toBe(true);
        expect(hostAllowed("go.acme.com", ["acme.com"])).toBe(true);
        expect(hostAllowed("notacme.com", ["acme.com"])).toBe(false);
        expect(hostAllowed("acme.com.evil.com", ["acme.com"])).toBe(false);
    });

    it("normalises the allowed entries (scheme, www, case, trailing dot)", () => {
        expect(hostAllowed("acme.com", ["https://WWW.Acme.com/"])).toBe(true);
    });

    it("never allows an unreadable link, and allows nothing when nothing is owned", () => {
        expect(hostAllowed(null, ["acme.com"])).toBe(false);
        expect(hostAllowed("acme.com", [])).toBe(false);
    });
});
