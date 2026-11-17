import { describe, expect, it, vi } from "vitest";
import { guessEmail, verifyEmailAddress, type VerifyDeps } from "./emailStatus";

const deps = (over: Partial<VerifyDeps> = {}): VerifyDeps => ({
    lookupMx: vi.fn().mockResolvedValue(["mx.acme.com"]),
    providerVerify: vi.fn().mockResolvedValue({ status: "valid" }),
    ...over,
});

describe("verifyEmailAddress ladder", () => {
    it("bad syntax is INVALID and costs nothing", async () => {
        const d = deps();
        expect(await verifyEmailAddress("not-an-email", d)).toEqual({ status: "INVALID", source: "SYNTAX", usedProvider: false });
        expect(d.lookupMx).not.toHaveBeenCalled();
        expect(d.providerVerify).not.toHaveBeenCalled();
    });

    it("a domain with no MX is INVALID without a provider call", async () => {
        const d = deps({ lookupMx: vi.fn().mockResolvedValue([]) });
        expect(await verifyEmailAddress("ann@nomail.example", d)).toEqual({ status: "INVALID", source: "NO_MX", usedProvider: false });
        expect(d.providerVerify).not.toHaveBeenCalled();
    });

    it("a role address is RISKY without a provider call", async () => {
        const d = deps();
        expect(await verifyEmailAddress("Info@Acme.com", d)).toEqual({ status: "RISKY", source: "ROLE", usedProvider: false });
        expect(d.providerVerify).not.toHaveBeenCalled();
    });

    it.each([
        ["valid", "VERIFIED"],
        ["invalid", "INVALID"],
        ["accept_all", "RISKY"],
        ["unknown", "UNKNOWN"],
    ])("provider says %s -> %s", async (providerStatus, expected) => {
        const r = await verifyEmailAddress("ann@acme.com", deps({ providerVerify: vi.fn().mockResolvedValue({ status: providerStatus }) }));
        expect(r).toMatchObject({ status: expected, source: "HUNTER", usedProvider: true });
    });

    it("a provider timeout or error leaves the lead UNKNOWN, not INVALID", async () => {
        expect(await verifyEmailAddress("ann@acme.com", deps({ providerVerify: vi.fn().mockRejectedValue(new Error("timeout")) }))).toMatchObject({ status: "UNKNOWN", usedProvider: true });
        expect(await verifyEmailAddress("ann@acme.com", deps({ providerVerify: vi.fn().mockResolvedValue(null) }))).toMatchObject({ status: "UNKNOWN" });
    });

    it("a DNS outage is not an answer: it falls through to the provider", async () => {
        const d = deps({ lookupMx: vi.fn().mockRejectedValue(new Error("SERVFAIL")) });
        expect(await verifyEmailAddress("ann@acme.com", d)).toMatchObject({ status: "VERIFIED", source: "HUNTER" });
    });
});

describe("guessEmail", () => {
    const verified = [
        { fullName: "Bo Lee", email: "bo.lee@acme.com" },
        { fullName: "Cy Ray", email: "cy.ray@acme.com" },
    ];

    it("builds the address from the pattern verified colleagues use, and marks it GUESS", () => {
        expect(guessEmail("Ann Cole", "acme.com", verified)).toEqual({ email: "ann.cole@acme.com", status: "GUESS", source: "PATTERN" });
    });

    it("works out first@ and flast@ patterns too", () => {
        expect(guessEmail("Ann Cole", "acme.com", [{ fullName: "Bo Lee", email: "bo@acme.com" }])?.email).toBe("ann@acme.com");
        expect(guessEmail("Ann Cole", "acme.com", [{ fullName: "Bo Lee", email: "blee@acme.com" }])?.email).toBe("acole@acme.com");
    });

    it("guesses nothing without a pattern, a second name, or a matching domain", () => {
        expect(guessEmail("Ann Cole", "acme.com", [])).toBeNull();
        expect(guessEmail("Ann", "acme.com", verified)).toBeNull();
        expect(guessEmail("Ann Cole", "other.com", verified)).toBeNull();
    });

    it("ignores colleagues whose address fits no known pattern", () => {
        expect(guessEmail("Ann Cole", "acme.com", [{ fullName: "Bo Lee", email: "boss42@acme.com" }])).toBeNull();
    });
});
