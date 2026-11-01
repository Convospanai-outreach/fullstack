import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_PATHS, pageLink, readShownDomain, shownDomain, validatePagePath, writeShownDomain } from "./landingPageAddress";

const reservedFixture = JSON.parse(readFileSync(resolve(__dirname, "../../../tests/fixtures/landing-reserved-paths.json"), "utf8")) as {
    reservedPaths: string[];
};

describe("reserved page addresses", () => {
    it("match the shared fixture the API copy is also tested against", () => {
        expect([...RESERVED_PATHS].sort()).toEqual([...reservedFixture.reservedPaths].sort());
    });

    it.each(reservedFixture.reservedPaths)("refuses %s", (word) => {
        expect(validatePagePath(word).ok).toBe(false);
    });

    it("says the address is reserved, not just malformed", () => {
        expect(validatePagePath("thank-you")).toEqual({ ok: false, error: "That web address is reserved. Try another." });
    });
});

describe("validatePagePath", () => {
    it.each([
        ["spring-guide", "spring-guide"],
        ["  Spring-Guide  ", "spring-guide"],
        ["go2", "go2"],
        ["a".repeat(63), "a".repeat(63)],
    ])("accepts %j as %j", (input, expected) => {
        expect(validatePagePath(input)).toEqual({ ok: true, path: expected });
    });

    it.each([
        ["an empty path", ""],
        ["a single character", "a"],
        ["64 characters", "a".repeat(64)],
        ["a leading hyphen", "-guide"],
        ["an underscore", "spring_guide"],
        ["a space inside", "spring guide"],
        ["a slash", "spring/guide"],
        ["non-ascii letters", "über"],
    ])("rejects %s", (_label, input) => {
        const result = validatePagePath(input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/2 to 63 letters, numbers or hyphens/);
    });
});

describe("validatePagePath with the page's current address", () => {
    it.each([
        ["a single character", "a"],
        ["64 characters", "a".repeat(64)],
    ])("keeps a legacy address of %s when it is saved unchanged", (_label, current) => {
        expect(validatePagePath(current, current)).toEqual({ ok: true, path: current });
    });

    it("still rejects a new 64-character address", () => {
        const result = validatePagePath("b".repeat(64), "a");
        expect(result.ok).toBe(false);
    });
});

describe("pageLink", () => {
    it("builds the address on an apex domain", () => {
        expect(pageLink("yourbrand.com", "spring-guide")).toBe("https://yourbrand.com/spring-guide");
    });

    it("builds the address on a www domain", () => {
        expect(pageLink("www.yourbrand.com", "spring-guide")).toBe("https://www.yourbrand.com/spring-guide");
    });

    it("builds the address on a subdomain such as go.yourbrand.com", () => {
        expect(pageLink("go.yourbrand.com", "spring-guide")).toBe("https://go.yourbrand.com/spring-guide");
    });

    it("falls back to the app's own /p address when the team has no active domain", () => {
        expect(pageLink(null, "spring-guide")).toBe("/p/spring-guide");
        expect(pageLink(undefined, "spring-guide")).toBe("/p/spring-guide");
    });
});

describe("shownDomain", () => {
    const domains = ["yourbrand.com", "go.yourbrand.com"];

    it("remembers the domain picked in the list, and reads it back", () => {
        const store = new Map<string, string>();
        const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };

        writeShownDomain("go.yourbrand.com", storage);

        expect(readShownDomain(storage)).toBe("go.yourbrand.com");
    });

    it("reads nothing and writes nothing without usable storage, instead of throwing", () => {
        const blocked = {
            getItem: () => {
                throw new Error("SecurityError");
            },
            setItem: () => {
                throw new Error("QuotaExceededError");
            },
        };

        expect(readShownDomain(blocked)).toBeNull();
        expect(() => writeShownDomain("go.yourbrand.com", blocked)).not.toThrow();
        expect(readShownDomain(undefined)).toBeNull();
    });

    it("shows the preferred domain when it is one of the team's domains", () => {
        expect(shownDomain(domains, "go.yourbrand.com")).toBe("go.yourbrand.com");
    });

    it("shows the first domain when the preferred one is not in the list", () => {
        expect(shownDomain(domains, "other.example.com")).toBe("yourbrand.com");
    });

    it("shows the first domain when there is no preference", () => {
        expect(shownDomain(domains, null)).toBe("yourbrand.com");
    });

    it("returns null when the team has no active domain", () => {
        expect(shownDomain([], "yourbrand.com")).toBeNull();
    });
});
