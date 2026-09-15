import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { ensureResendDomainVerified, removeResendDomain, updateResendDomainTracking } from "../resendDomainService";
import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/security/credentialVault";
import { BrandingService } from "@/modules/branding/brandingService";
import { resolveTxt } from "dns/promises";

const { mockPrisma, mockDomainsList, mockDomainsCreate, mockDomainsGet, mockDomainsVerify, mockDomainsRemove, mockDomainsUpdate } = vi.hoisted(() => ({
    mockPrisma: {
        connectedMailbox: { findFirst: vi.fn() },
        domainAuthenticationCheck: { findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn(), delete: vi.fn() },
        customDomain: { findUnique: vi.fn() },
    },
    mockDomainsList: vi.fn(),
    mockDomainsCreate: vi.fn(),
    mockDomainsGet: vi.fn(),
    mockDomainsVerify: vi.fn(),
    mockDomainsRemove: vi.fn(),
    mockDomainsUpdate: vi.fn(),
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
            remove: mockDomainsRemove,
            update: mockDomainsUpdate,
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
        (prisma.domainAuthenticationCheck.create as Mock).mockResolvedValue({});
        (prisma.domainAuthenticationCheck.delete as Mock).mockResolvedValue({});
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

    it("claims a placeholder row before creating a brand-new domain in Resend, to guard against a concurrent duplicate create", async () => {
        await ensureResendDomainVerified({ teamId: "team-1", domain: "team.test" });

        expect(prisma.domainAuthenticationCheck.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ teamId: "team-1", domain: "team.test", provider: "RESEND" }),
            }),
        );
        expect((prisma.domainAuthenticationCheck.create as Mock).mock.invocationCallOrder[0]).toBeLessThan(
            mockDomainsCreate.mock.invocationCallOrder[0]
        );
    });

    it("surfaces a friendly retry error when a concurrent request already claimed this domain", async () => {
        (prisma.domainAuthenticationCheck.create as Mock).mockRejectedValue(
            Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
        );

        await expect(ensureResendDomainVerified({ teamId: "team-1", domain: "team.test" })).rejects.toThrow(
            "already in progress"
        );
        expect(mockDomainsCreate).not.toHaveBeenCalled();
    });

    it("releases its claim row if Resend rejects the new domain, so a retry isn't permanently blocked", async () => {
        mockDomainsCreate.mockResolvedValue({ data: null, error: { message: "Invalid domain" } });

        await expect(ensureResendDomainVerified({ teamId: "team-1", domain: "team.test" })).rejects.toThrow(
            "Invalid domain"
        );
        expect(prisma.domainAuthenticationCheck.delete).toHaveBeenCalledWith({
            where: { teamId_domain_provider: { teamId: "team-1", domain: "team.test", provider: "RESEND" } },
        });
    });

    it("throws when the team has no connected Resend mailbox", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(null);

        await expect(ensureResendDomainVerified({ teamId: "team-1", domain: "team.test" })).rejects.toThrow(
            "Connect a Resend mailbox"
        );
    });
});

describe("removeResendDomain", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailbox);
        (decryptCredential as Mock).mockResolvedValue("re_test_api_key");
        (prisma.domainAuthenticationCheck.findUnique as Mock).mockResolvedValue({ providerDomainId: "domain-1" });
        (prisma.domainAuthenticationCheck.delete as Mock).mockResolvedValue({});
        mockDomainsRemove.mockResolvedValue({ data: { id: "domain-1", deleted: true }, error: null });
    });

    it("removes the domain from Resend and clears the local check row", async () => {
        const result = await removeResendDomain({ teamId: "team-1", domain: "team.test" });

        expect(mockDomainsRemove).toHaveBeenCalledWith("domain-1");
        expect(prisma.domainAuthenticationCheck.delete).toHaveBeenCalledWith({
            where: { teamId_domain_provider: { teamId: "team-1", domain: "team.test", provider: "RESEND" } },
        });
        expect(result).toEqual({ domain: "team.test", removed: true });
    });

    it("throws when no domain check exists for this team/domain", async () => {
        (prisma.domainAuthenticationCheck.findUnique as Mock).mockResolvedValue(null);

        await expect(removeResendDomain({ teamId: "team-1", domain: "team.test" })).rejects.toThrow(
            "No Resend domain check found"
        );
        expect(mockDomainsRemove).not.toHaveBeenCalled();
    });

    it("treats an already-removed domain on Resend's side as success rather than an error", async () => {
        mockDomainsRemove.mockResolvedValue({ data: null, error: { message: "Domain not found" } });

        const result = await removeResendDomain({ teamId: "team-1", domain: "team.test" });

        expect(result).toEqual({ domain: "team.test", removed: true });
        expect(prisma.domainAuthenticationCheck.delete).toHaveBeenCalled();
    });

    it("surfaces a genuine Resend rejection and leaves the local check row intact", async () => {
        mockDomainsRemove.mockResolvedValue({ data: null, error: { message: "Insufficient permissions on this API key" } });

        await expect(removeResendDomain({ teamId: "team-1", domain: "team.test" })).rejects.toThrow(
            "Insufficient permissions"
        );
        expect(prisma.domainAuthenticationCheck.delete).not.toHaveBeenCalled();
    });
});

describe("updateResendDomainTracking", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailbox);
        (decryptCredential as Mock).mockResolvedValue("re_test_api_key");
        (prisma.domainAuthenticationCheck.findUnique as Mock).mockResolvedValue({ providerDomainId: "domain-1" });
        mockDomainsUpdate.mockResolvedValue({ data: { id: "domain-1" }, error: null });
    });

    it("forwards openTracking/clickTracking to Resend's update call", async () => {
        const result = await updateResendDomainTracking({ teamId: "team-1", domain: "team.test", openTracking: false, clickTracking: true });

        expect(mockDomainsUpdate).toHaveBeenCalledWith({ id: "domain-1", openTracking: false, clickTracking: true });
        expect(result).toEqual({ domain: "team.test", openTracking: false, clickTracking: true });
    });

    it("allows updating just one of the two flags", async () => {
        await updateResendDomainTracking({ teamId: "team-1", domain: "team.test", clickTracking: true });

        expect(mockDomainsUpdate).toHaveBeenCalledWith({ id: "domain-1", clickTracking: true });
    });

    it("rejects when neither flag is provided", async () => {
        await expect(updateResendDomainTracking({ teamId: "team-1", domain: "team.test" })).rejects.toThrow(
            "Provide at least one"
        );
        expect(mockDomainsUpdate).not.toHaveBeenCalled();
    });

    it("throws when no domain check exists for this team/domain", async () => {
        (prisma.domainAuthenticationCheck.findUnique as Mock).mockResolvedValue(null);

        await expect(updateResendDomainTracking({ teamId: "team-1", domain: "team.test", openTracking: true })).rejects.toThrow(
            "No Resend domain check found"
        );
    });

    it("surfaces a Resend rejection", async () => {
        mockDomainsUpdate.mockResolvedValue({ data: null, error: { message: "Invalid tls value" } });

        await expect(updateResendDomainTracking({ teamId: "team-1", domain: "team.test", openTracking: true })).rejects.toThrow(
            "Invalid tls value"
        );
    });
});
