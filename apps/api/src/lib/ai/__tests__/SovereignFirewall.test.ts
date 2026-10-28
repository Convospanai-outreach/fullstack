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
