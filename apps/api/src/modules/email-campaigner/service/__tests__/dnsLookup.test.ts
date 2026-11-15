import { beforeEach, describe, expect, it, vi } from "vitest";

const { publicTxt, systemTxt } = vi.hoisted(() => ({ publicTxt: vi.fn(), systemTxt: vi.fn() }));

vi.mock("dns/promises", () => ({
    Resolver: class {
        setServers() {}
        resolveTxt = publicTxt;
        resolveMx = vi.fn();
    },
    resolveTxt: systemTxt,
    resolveMx: vi.fn(),
}));

import { DnsUnavailableError, lookupTxt } from "../dnsLookup";

const err = (code: string) => Object.assign(new Error(code), { code });

describe("lookupTxt", () => {
    beforeEach(() => vi.clearAllMocks());

    it("joins split TXT strings from the public resolver", async () => {
        publicTxt.mockResolvedValue([["v=spf1 ", "include:x ~all"]]);
        expect(await lookupTxt("example.com")).toEqual(["v=spf1 include:x ~all"]);
        expect(systemTxt).not.toHaveBeenCalled();
    });

    it("treats no such record as an empty answer without asking again", async () => {
        publicTxt.mockRejectedValue(err("ENODATA"));
        expect(await lookupTxt("example.com")).toEqual([]);
        expect(systemTxt).not.toHaveBeenCalled();
    });

    it("falls back to the system resolver when the public one times out", async () => {
        publicTxt.mockRejectedValue(err("ETIMEOUT"));
        systemTxt.mockResolvedValue([["v=DMARC1; p=none"]]);
        expect(await lookupTxt("_dmarc.example.com")).toEqual(["v=DMARC1; p=none"]);
    });

    it("throws DnsUnavailableError when neither resolver can answer", async () => {
        publicTxt.mockRejectedValue(err("ETIMEOUT"));
        systemTxt.mockRejectedValue(err("ESERVFAIL"));
        await expect(lookupTxt("example.com")).rejects.toBeInstanceOf(DnsUnavailableError);
    });
});
