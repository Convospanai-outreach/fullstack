import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockCreateCustomHostname } = vi.hoisted(() => ({
    mockPrisma: {
        customDomain: { create: vi.fn() },
    },
    mockCreateCustomHostname: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("./cloudflareCustomHostnameService", () => ({ createCustomHostname: mockCreateCustomHostname }));

import { BrandingService } from "./brandingService";

describe("BrandingService.addDomain", () => {
    beforeEach(() => vi.clearAllMocks());

    it("stores the Cloudflare hostname id and TXT ownership record alongside the pending domain", async () => {
        mockCreateCustomHostname.mockResolvedValue({
            cloudflareHostnameId: "cf-1",
            ownershipVerification: { name: "_cf-custom-hostname.go.example.com", value: "abc123" },
        });
        mockPrisma.customDomain.create.mockResolvedValue({ id: "cd-1" });

        await BrandingService.addDomain("team-1", "go.example.com");

        expect(mockPrisma.customDomain.create).toHaveBeenCalledWith({
            data: {
                teamId: "team-1",
                domain: "go.example.com",
                status: "pending",
                cloudflareHostnameId: "cf-1",
                ownershipVerificationName: "_cf-custom-hostname.go.example.com",
                ownershipVerificationValue: "abc123",
            },
        });
    });

    it("still creates a pending row (without Cloudflare fields) if the Cloudflare call fails", async () => {
        mockCreateCustomHostname.mockRejectedValue(new Error("Cloudflare down"));
        mockPrisma.customDomain.create.mockResolvedValue({ id: "cd-1" });

        await BrandingService.addDomain("team-1", "go.example.com");

        expect(mockPrisma.customDomain.create).toHaveBeenCalledWith({
            data: {
                teamId: "team-1",
                domain: "go.example.com",
                status: "pending",
                cloudflareHostnameId: null,
                ownershipVerificationName: null,
                ownershipVerificationValue: null,
            },
        });
    });
});
