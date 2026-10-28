import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({ default: { post: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")) } }));
vi.mock("@/modules/identity/IdentityService", () => ({ IdentityService: {} }));

import { SovereignFirewall } from "../SovereignFirewall";

const TEXT = "Call me on +91 98765 43210 or write to jane.doe@acme.com, thanks";

describe("SovereignFirewall.mask when the Edge Node is unavailable", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        delete process.env["STRICT_SOVEREIGNTY"];
    });
    afterEach(() => vi.restoreAllMocks());

    it("passes text through unchanged by default (existing behaviour for other callers)", async () => {
        const { safeContext } = await SovereignFirewall.mask(TEXT);
        expect(safeContext).toBe(TEXT);
    });

    it("masks emails and phone numbers locally with alwaysMask, and can restore them", async () => {
        const { safeContext, tokenMap } = await SovereignFirewall.mask(TEXT, "GLOBAL", undefined, { alwaysMask: true });

        expect(safeContext).not.toContain("jane.doe@acme.com");
        expect(safeContext).not.toContain("98765 43210");
        expect(safeContext).toContain("thanks");
        expect(SovereignFirewall.unmask(safeContext, tokenMap)).toBe(TEXT);
    });
});

describe("SovereignFirewall.maskKnownNames", () => {
    it("replaces the person, each word of their name and the company, and unmask restores them", () => {
        const text = "Thanks - Jane Doe, Acme Robotics. jane here; Janet from IT said hi. Doe's team";
        const { safeContext, tokenMap } = SovereignFirewall.maskKnownNames(text, { person: "Jane Doe", company: "Acme Robotics" });

        expect(safeContext).not.toMatch(/Jane Doe|Acme|Robotics/);
        expect(safeContext).not.toMatch(/\bjane\b/i);
        expect(safeContext).toContain("Janet");
        expect(SovereignFirewall.unmask(safeContext, tokenMap)).toBe(text);
    });

    it("leaves text alone when there are no names, and ignores 1-2 letter name parts", () => {
        expect(SovereignFirewall.maskKnownNames("Hello Al", {}).safeContext).toBe("Hello Al");
        expect(SovereignFirewall.maskKnownNames("Hello Al Smith", { person: "Al Smith" }).safeContext).not.toContain("Smith");
        expect(SovereignFirewall.maskKnownNames("I am at home", { person: "Al Smith", company: "at" }).safeContext).toBe("I am at home");
    });

    it("treats regex characters in a company name literally", () => {
        const { safeContext } = SovereignFirewall.maskKnownNames("Ping C++ (Labs) now", { company: "C++ (Labs)" });
        expect(safeContext).toMatch(/^Ping \[COMPANY_[a-f0-9]{12}\] now$/);
    });
});
