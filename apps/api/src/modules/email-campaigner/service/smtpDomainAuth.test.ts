import { beforeEach, describe, expect, it, vi } from "vitest";

const { mx, txt } = vi.hoisted(() => ({ mx: vi.fn(), txt: vi.fn() }));
vi.mock("./dnsLookup", () => ({ lookupMx: mx, lookupTxt: txt }));

import { checkSmtpDomainAuth } from "./smtpDomainAuth";

const dns = (records: Record<string, string[]>) => txt.mockImplementation(async (host: string) => records[host] ?? []);

describe("checkSmtpDomainAuth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mx.mockResolvedValue(["mx.example.com"]);
    });

    it("verifies all four records and uses the selector the user gave", async () => {
        dns({
            "acme.com": ["v=spf1 include:_spf.google.com ~all"],
            "_dmarc.acme.com": ["v=DMARC1; p=none"],
            "s1._domainkey.acme.com": ["v=DKIM1; k=rsa; p=ABC123"],
        });
        const r = await checkSmtpDomainAuth({ domain: "Acme.com.", selector: "s1", spfInclude: "_spf.google.com" });
        expect(r.status).toBe("VERIFIED");
        expect(r.missing).toEqual([]);
        expect(r.selector).toBe("s1");
    });

    it("says what to add for each missing record, with the host's SPF include", async () => {
        dns({});
        mx.mockResolvedValue([]);
        const r = await checkSmtpDomainAuth({ domain: "acme.com", spfInclude: "zoho.com" });
        expect(r.missing).toEqual(["MX", "SPF", "DMARC", "DKIM"]);
        expect(r.records["spf"]!.hint).toContain("v=spf1 include:zoho.com ~all");
        expect(r.records["dmarc"]!.hint).toContain("_dmarc.acme.com");
        expect(r.records["dkim"]!.hint).toContain("enter the selector");
    });

    it("tells the user to merge into one SPF record rather than add a second", async () => {
        dns({ "acme.com": ["v=spf1 include:a.com ~all"] });
        const r = await checkSmtpDomainAuth({ domain: "acme.com", spfInclude: "zoho.com" });
        expect(r.records["spf"]!.status).toBe("MISSING");
        expect(r.records["spf"]!.hint).toContain("do not create a second one");
        dns({ "acme.com": ["v=spf1 include:a.com ~all", "v=spf1 include:b.com ~all"] });
        expect((await checkSmtpDomainAuth({ domain: "acme.com" })).records["spf"]!.hint).toContain("more than one SPF");
    });

    it("finds DMARC on the parent domain and DKIM at a common selector, and ignores a revoked key", async () => {
        dns({
            "mail.acme.com": ["v=spf1 ~all"],
            "_dmarc.acme.com": ["v=DMARC1; p=reject"],
            "default._domainkey.mail.acme.com": ["v=DKIM1; p=KEY"],
            "google._domainkey.mail.acme.com": ["v=DKIM1; p="],
        });
        const r = await checkSmtpDomainAuth({ domain: "mail.acme.com" });
        expect(r.records["dmarc"]!.status).toBe("VERIFIED");
        expect(r.records["dkim"]!.status).toBe("VERIFIED");
        expect(r.records["dkim"]!.host).toBe("default._domainkey.mail.acme.com");
    });

    it("rejects an invalid domain, selector or include before any DNS query", async () => {
        await expect(checkSmtpDomainAuth({ domain: "abc" })).rejects.toThrow("Enter a valid domain");
        await expect(checkSmtpDomainAuth({ domain: "a.com", selector: "bad host" })).rejects.toThrow("valid DKIM selector");
        await expect(checkSmtpDomainAuth({ domain: "a.com", spfInclude: "x y" })).rejects.toThrow("valid SPF include");
        expect(txt).not.toHaveBeenCalled();
    });
});
