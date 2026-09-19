import { describe, expect, it } from "vitest";
import {
    normalizeDomainStrict,
    tryNormalizeDomain,
    extractDomainFromEmail,
    normalizeCompanyName,
    getAccountKey,
} from "../domain";

describe("normalizeDomainStrict", () => {
    it("lowercases, trims, and strips a trailing dot", () => {
        expect(normalizeDomainStrict("  Example.COM. ")).toBe("example.com");
    });

    it("throws on a syntactically invalid domain", () => {
        expect(() => normalizeDomainStrict("not a domain")).toThrow(/Enter a valid domain/);
    });
});

describe("tryNormalizeDomain", () => {
    it("returns null instead of throwing on invalid input", () => {
        expect(tryNormalizeDomain("not a domain")).toBeNull();
        expect(tryNormalizeDomain(null)).toBeNull();
        expect(tryNormalizeDomain(undefined)).toBeNull();
        expect(tryNormalizeDomain("")).toBeNull();
    });

    it("strips a URL protocol, path, query, and leading www", () => {
        expect(tryNormalizeDomain("https://www.acme.example/about?x=1")).toBe("acme.example");
        expect(tryNormalizeDomain("http://acme.example")).toBe("acme.example");
        expect(tryNormalizeDomain("acme.example")).toBe("acme.example");
    });

    it("rejects a single-label host with no dot", () => {
        expect(tryNormalizeDomain("localhost")).toBeNull();
    });
});

describe("extractDomainFromEmail", () => {
    it("extracts and normalizes the domain portion of an email", () => {
        expect(extractDomainFromEmail("lead@Acme.Example")).toBe("acme.example");
    });

    it("returns null for malformed or missing email", () => {
        expect(extractDomainFromEmail("no-at-sign")).toBeNull();
        expect(extractDomainFromEmail(null)).toBeNull();
        expect(extractDomainFromEmail("lead@localhost")).toBeNull();
    });
});

describe("normalizeCompanyName", () => {
    it("strips punctuation/case as before", () => {
        expect(normalizeCompanyName("Acme, Inc.")).toBe(normalizeCompanyName("acme inc"));
    });

    it("strips common legal suffixes so variants match", () => {
        expect(normalizeCompanyName("Acme Corp")).toBe(normalizeCompanyName("Acme Corporation"));
        expect(normalizeCompanyName("Acme Pvt Ltd")).toBe(normalizeCompanyName("Acme Private Limited"));
        expect(normalizeCompanyName("Acme LLC")).toBe(normalizeCompanyName("Acme"));
    });

    it("returns empty string for null/undefined", () => {
        expect(normalizeCompanyName(null)).toBe("");
        expect(normalizeCompanyName(undefined)).toBe("");
    });
});

describe("getAccountKey", () => {
    it("prefers domain when present", () => {
        expect(getAccountKey({ domain: "acme.example", company: "Something Else" })).toBe("domain:acme.example");
    });

    it("falls back to normalized company name when no domain", () => {
        expect(getAccountKey({ domain: null, company: "Acme Corp" })).toBe(`company:${normalizeCompanyName("Acme Corp")}`);
    });

    it("returns null when neither domain nor company is available", () => {
        expect(getAccountKey({ domain: null, company: null })).toBeNull();
    });
});
