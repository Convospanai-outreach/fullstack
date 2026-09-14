import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { ensureResendDomainVerified } from "../resendDomainService";
import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/security/credentialVault";
import { BrandingService } from "@/modules/branding/brandingService";
import { resolveTxt } from "dns/promises";

const { mockPrisma, mockDomainsList, mockDomainsCreate, mockDomainsGet, mockDomainsVerify } = vi.hoisted(() => ({
    mockPrisma: {
        connectedMailbox: { findFirst: vi.fn() },
        domainAuthenticationCheck: { findUnique: vi.fn(), upsert: vi.fn() },
        customDomain: { findUnique: vi.fn() },
    },
    mockDomainsList: vi.fn(),
    mockDomainsCreate: vi.fn(),
    mockDomainsGet: vi.fn(),
    mockDomainsVerify: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: vi.fn() }));
vi.mock("@/modules/branding/brandingService", () => ({
    BrandingService: { addDomain: vi.fn() },
}));
vi.mock("dns/promises", () => ({ resolveTxt: vi.fn() }));
vi.mock("resend", () => ({
    Resend: vi.fn().mockImplementation(function (this: any) {
        this.domains = {
            list: mockDomainsList,
            create: mockDomainsCreate,
            get: mockDomainsGet,
            verify: mockDomainsVerify,
        };
    }),
}));

const mailbox = {
    id: "resend-mailbox-1",
    teamId: "team-1",
    provider: "RESEND",
    encryptedAccessToken: { encrypted: true },
};

const verifiedDomain = {
    id: "domain-1",
    name: "team.test",
    status: "verified",
    records: [
        { record: "SPF", type: "TXT", name: "team.test", value: "v=spf1 include:amazonses.com ~all", status: "verified" },
        { record: "DKIM", type: "CNAME", name: "resend._domainkey.team.test", value: "abc.dkim.resend.com", status: "verified" },
    ],
};

describe("ensureResendDomainVerified", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailbox);
        (decryptCredential as Mock).mockResolvedValue("re_test_api_key");
        (prisma.domainAuthenticationCheck.findUnique as Mock).mockResolvedValue(null);
        (prisma.domainAuthenticationCheck.upsert as Mock).mockResolvedValue({});
        (prisma.customDomain.findUnique as Mock).mockResolvedValue(null);
        (BrandingService.addDomain as Mock).mockResolvedValue({});
        (resolveTxt as Mock).mockResolvedValue([["v=DMARC1; p=none"]]);
        mockDomainsList.mockResolvedValue({ data: { data: [] } });
        mockDomainsCreate.mockResolvedValue({ data: { id: "domain-1" }, error: null });
        mockDomainsVerify.mockResolvedValue({ data: {}, error: null });
        mockDomainsGet.mockResolvedValue({ data: verifiedDomain, error: null });
    });

    it("creates the domain with Resend when it hasn't been registered yet, and reports it verified", async () => {
        const result = await ensureResendDomainVerified({ teamId: "team-1", domain: "team.test" });

        expect(mockDomainsCreate).toHaveBeenCalledWith({ name: "team.test" });
        expect(result.status).toBe("VERIFIED");
        expect(result.records.spf.status).toBe("VERIFIED");
        expect(result.records.dkim.status).toBe("VERIFIED");
        expect(result.missing).toEqual([]);
    });

    it("reuses the stored provider domain id instead of re-creating the domain", async () => {
        (prisma.domainAuthenticationCheck.findUnique as Mock).mockResolvedValue({ providerDomainId: "domain-1" });

        await ensureResendDomainVerified({ teamId: "team-1", domain: "team.test" });

        expect(mockDomainsCreate).not.toHaveBeenCalled();
        expect(mockDomainsGet).toHaveBeenCalledWith("domain-1");
    });

    it("reports missing records and skips DMARC when the DNS lookup finds none", async () => {
        (resolveTxt as Mock).mockResolvedValue([]);
        mockDomainsGet.mockResolvedValue({
            data: {
                ...verifiedDomain,
                status: "pending",
                records: verifiedDomain.records.map((r) => ({ ...r, status: "pending" })),
            },
            error: null,
        });

        const result = await ensureResendDomainVerified({ teamId: "team-1", domain: "team.test" });

        expect(result.status).toBe("MISSING");
        expect(result.missing).toEqual(expect.arrayContaining(["Resend SPF", "Resend DKIM", "DMARC TXT (recommended)"]));
        expect(result.records.dkim.values).toEqual(["abc.dkim.resend.com"]);
    });

    it("registers the domain as a CustomDomain when none exists yet, but skips it if already claimed", async () => {
        await ensureResendDomainVerified({ teamId: "team-1", domain: "team.test" });
        expect(BrandingService.addDomain).toHaveBeenCalledWith("team-1", "team.test");

        (BrandingService.addDomain as Mock).mockClear();
        (prisma.customDomain.findUnique as Mock).mockResolvedValue({ teamId: "team-1", domain: "team.test" });

        await ensureResendDomainVerified({ teamId: "team-1", domain: "team.test" });
        expect(BrandingService.addDomain).not.toHaveBeenCalled();
    });

    it("throws when the team has no connected Resend mailbox", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(null);

        await expect(ensureResendDomainVerified({ teamId: "team-1", domain: "team.test" })).rejects.toThrow(
            "Connect a Resend mailbox"
        );
    });
});
