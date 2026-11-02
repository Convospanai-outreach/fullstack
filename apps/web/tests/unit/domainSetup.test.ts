import { describe, it, expect } from "vitest";
import { emailDomainsReady, fixesFor } from "@/lib/domainSetup";

const ok = { domain: "a.example", mx: true, spf: true, dkim: true, dmarc: true };

describe("domain setup helpers", () => {
    it("lists a fix for each missing record, in a fixed order", () => {
        expect(fixesFor({ ...ok, dmarc: false, spf: false }).map((f) => f.record)).toEqual(["spf", "dmarc"]);
        expect(fixesFor(ok)).toEqual([]);
    });

    it("is ready only when at least one sending domain exists and all pass", () => {
        expect(emailDomainsReady([])).toBe(false);
        expect(emailDomainsReady([ok])).toBe(true);
        expect(emailDomainsReady([ok, { ...ok, domain: "b.example", dkim: false }])).toBe(false);
    });

    it("ignores domains no mailbox sends from any more", () => {
        expect(emailDomainsReady([ok, { ...ok, domain: "old.example", spf: false, active: false }])).toBe(true);
    });
});

describe("domainBannerFor", () => {
    it("is silent with no domains or when all pass", async () => {
        const { domainBannerFor } = await import("@/lib/domainSetup");
        expect(domainBannerFor([])).toBeNull();
        expect(domainBannerFor([ok])).toBeNull();
    });

    it("names each failing sending domain and mentions the 24 to 48 hour wait", async () => {
        const { domainBannerFor } = await import("@/lib/domainSetup");
        const banner = domainBannerFor([ok, { ...ok, domain: "b.example", spf: false }, { ...ok, domain: "old.example", spf: false, active: false }]);
        expect(banner?.domains).toEqual(["b.example"]);
        expect(banner?.text).toContain("b.example is not fully verified");
        expect(banner?.text).toContain("24 to 48 hours");
    });
});
