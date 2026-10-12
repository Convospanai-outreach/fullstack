import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockCreateCustomHostname, mockRemoveCustomHostname } = vi.hoisted(() => ({
    mockPrisma: {
        customDomain: { create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
    },
    mockCreateCustomHostname: vi.fn(),
    mockRemoveCustomHostname: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("./cloudflareCustomHostnameService", () => ({
    createCustomHostname: mockCreateCustomHostname,
    removeCustomHostname: mockRemoveCustomHostname,
}));

import { BrandingService, CustomDomainsUnavailableError } from "./brandingService";

describe("BrandingService.addDomain", () => {
    beforeEach(() => vi.clearAllMocks());

    it("saves the domain with the Cloudflare hostname id the poller needs", async () => {
        mockCreateCustomHostname.mockResolvedValue({ cloudflareHostnameId: "cf-1", ownershipVerification: null });

        await BrandingService.addDomain("team-1", "go.example.com");

        expect(mockPrisma.customDomain.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ teamId: "team-1", domain: "go.example.com", status: "pending", cloudflareHostnameId: "cf-1" }),
        });
    });

    it("saves nothing when Cloudflare isn't configured", async () => {
        mockCreateCustomHostname.mockResolvedValue(null);

        await expect(BrandingService.addDomain("team-1", "go.example.com")).rejects.toBeInstanceOf(CustomDomainsUnavailableError);
        expect(mockPrisma.customDomain.create).not.toHaveBeenCalled();
    });

    it("saves nothing when Cloudflare rejects the hostname", async () => {
        mockCreateCustomHostname.mockRejectedValue(new Error("invalid hostname"));

        await expect(BrandingService.addDomain("team-1", "go.example.com")).rejects.toThrow("invalid hostname");
        expect(mockPrisma.customDomain.create).not.toHaveBeenCalled();
    });
});

describe("BrandingService.removeDomain", () => {
    beforeEach(() => vi.clearAllMocks());

    it("disconnects the domain at Cloudflare before deleting the row", async () => {
        mockPrisma.customDomain.findFirst.mockResolvedValue({ id: "cd-1", domain: "go.example.com", cloudflareHostnameId: "cf-1" });

        expect(await BrandingService.removeDomain("team-1", "cd-1")).toBe(true);

        expect(mockPrisma.customDomain.findFirst).toHaveBeenCalledWith({ where: { id: "cd-1", teamId: "team-1" } });
        expect(mockRemoveCustomHostname).toHaveBeenCalledWith("go.example.com", "cf-1");
        expect(mockPrisma.customDomain.deleteMany).toHaveBeenCalledWith({ where: { id: "cd-1", teamId: "team-1" } });
    });

    it("keeps the row when Cloudflare removal fails, so it can be retried", async () => {
        mockPrisma.customDomain.findFirst.mockResolvedValue({ id: "cd-1", domain: "go.example.com", cloudflareHostnameId: "cf-1" });
        mockRemoveCustomHostname.mockRejectedValue(new Error("Cloudflare down"));

        await expect(BrandingService.removeDomain("team-1", "cd-1")).rejects.toThrow("Cloudflare down");
        expect(mockPrisma.customDomain.deleteMany).not.toHaveBeenCalled();
    });

    it("touches nothing for another team's domain", async () => {
        mockPrisma.customDomain.findFirst.mockResolvedValue(null);

        expect(await BrandingService.removeDomain("team-1", "someone-elses")).toBe(false);
        expect(mockRemoveCustomHostname).not.toHaveBeenCalled();
        expect(mockPrisma.customDomain.deleteMany).not.toHaveBeenCalled();
    });
});
