import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTxt, mockMx } = vi.hoisted(() => ({ mockTxt: vi.fn(), mockMx: vi.fn() }));

vi.mock("../dnsLookup", () => ({
    lookupTxt: mockTxt,
    lookupMx: mockMx,
    DnsUnavailableError: class extends Error {},
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { checkDomainDeliverabilitySignals, dkimSelectorFromMetadata } from "../domainAuthService";

// DNS as a map of host -> TXT values; anything else is "no such record".
function dns(records: Record<string, string[]>, mx: string[] = ["mx.example.com"]) {
    mockMx.mockResolvedValue(mx);
    mockTxt.mockImplementation(async (host: string) => records[host] || []);
}

const GOOD_KEY = "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC";

describe("checkDomainDeliverabilitySignals", () => {
    beforeEach(() => vi.clearAllMocks());

    it("passes a Google Workspace domain with its own include, selector and DMARC", async () => {
        dns({
            "example.com": ["v=spf1 include:_spf.google.com ~all"],
            "_dmarc.example.com": ["v=DMARC1; p=reject"],
            "google._domainkey.example.com": [GOOD_KEY],
        });
        const result = await checkDomainDeliverabilitySignals("example.com", "GOOGLE_WORKSPACE");
        expect(result).toEqual({ domain: "example.com", mx: true, spf: true, dmarc: true, dkim: true });
    });

    it("fails SPF when the record lacks the provider's include, and says so", async () => {
        dns({
            "example.com": ["v=spf1 include:mailgun.org ~all"],
            "_dmarc.example.com": ["v=DMARC1; p=reject"],
            "google._domainkey.example.com": [GOOD_KEY],
        });
        const result = await checkDomainDeliverabilitySignals("example.com", "GOOGLE_WORKSPACE");
        expect(result.spf).toBe(false);
        expect(result.notes?.[0]).toContain("_spf.google.com");
    });

    it("fails SPF when two SPF records are published", async () => {
        dns({ "example.com": ["v=spf1 include:_spf.google.com ~all", "v=spf1 include:other.example ~all"] });
        const result = await checkDomainDeliverabilitySignals("example.com", "GOOGLE_WORKSPACE");
        expect(result.spf).toBe(false);
        expect(result.notes?.join(" ")).toContain("More than one SPF record");
    });

    it("checks Resend's SPF on the send subdomain and its resend selector", async () => {
        dns({
            "send.example.com": ["v=spf1 include:amazonses.com ~all"],
            "_dmarc.example.com": ["v=DMARC1; p=none"],
            "resend._domainkey.example.com": [GOOD_KEY],
        });
        const result = await checkDomainDeliverabilitySignals("example.com", "RESEND");
        expect(result).toMatchObject({ spf: true, dkim: true, dmarc: true });
        expect(result.notes?.join(" ")).toContain("p=none");
    });

    it("checks Microsoft 365's two selectors, and passes with only one published", async () => {
        dns({
            "example.com": ["v=spf1 include:spf.protection.outlook.com -all"],
            "selector2._domainkey.example.com": [GOOD_KEY],
        });
        const result = await checkDomainDeliverabilitySignals("example.com", "MICROSOFT_365");
        expect(result).toMatchObject({ spf: true, dkim: true });
    });

    it("tries common selectors for an SMTP host whose selector is unknown, and any SPF record counts", async () => {
        dns({ "example.com": ["v=spf1 include:smtp.example ~all"], "k1._domainkey.example.com": [GOOD_KEY] });
        const result = await checkDomainDeliverabilitySignals("example.com", "SMTP");
        expect(result).toMatchObject({ spf: true, dkim: true });
    });

    it("looks only at a selector the user gave, whatever the provider", async () => {
        dns({ "mail._domainkey.example.com": [GOOD_KEY], "google._domainkey.example.com": [GOOD_KEY] });
        expect((await checkDomainDeliverabilitySignals("example.com", "SMTP", "Mail")).dkim).toBe(true);
        dns({ "google._domainkey.example.com": [GOOD_KEY] });
        expect((await checkDomainDeliverabilitySignals("example.com", "GOOGLE_WORKSPACE", "custom1")).dkim).toBe(false);
    });

    it("ignores a selector that is not a valid DNS label", async () => {
        dns({ "google._domainkey.example.com": [GOOD_KEY] });
        expect((await checkDomainDeliverabilitySignals("example.com", "GOOGLE_WORKSPACE", "bad selector")).dkim).toBe(true);
        expect(mockTxt).not.toHaveBeenCalledWith(expect.stringContaining("bad selector"));
    });

    it("reads a selector back from mailbox metadata only when it is valid", () => {
        expect(dkimSelectorFromMetadata({ dkimSelector: " S1 " })).toBe("s1");
        expect(dkimSelectorFromMetadata({ dkimSelector: "a b" })).toBeUndefined();
        expect(dkimSelectorFromMetadata({ dkimSelector: 5 })).toBeUndefined();
        expect(dkimSelectorFromMetadata(null)).toBeUndefined();
    });

    it("does not count a revoked DKIM key (empty p=) and notes it", async () => {
        dns({ "google._domainkey.example.com": ["v=DKIM1; k=rsa; p="] });
        const result = await checkDomainDeliverabilitySignals("example.com", "GOOGLE_WORKSPACE");
        expect(result.dkim).toBe(false);
        expect(result.notes?.join(" ")).toContain("revoked");
    });

    it("finds DMARC on the organisational domain for a sending subdomain", async () => {
        dns({ "_dmarc.example.com": ["v=DMARC1; p=quarantine"] });
        const result = await checkDomainDeliverabilitySignals("mail.example.com", "SMTP");
        expect(result.dmarc).toBe(true);
    });

    it("reports everything missing for a domain with no records", async () => {
        dns({}, []);
        expect(await checkDomainDeliverabilitySignals("nodns.example", "SMTP")).toEqual({
            domain: "nodns.example", mx: false, spf: false, dmarc: false, dkim: false,
        });
    });

    it("lets a DNS outage surface instead of reporting records missing", async () => {
        mockMx.mockRejectedValue(new Error("DNS lookup for example.com could not be completed."));
        mockTxt.mockResolvedValue([]);
        await expect(checkDomainDeliverabilitySignals("example.com", "SMTP")).rejects.toThrow("could not be completed");
    });

    it("rejects an invalid domain before any DNS query", async () => {
        await expect(checkDomainDeliverabilitySignals("not a domain")).rejects.toThrow("Enter a valid domain, such as example.com.");
        expect(mockMx).not.toHaveBeenCalled();
    });
});
