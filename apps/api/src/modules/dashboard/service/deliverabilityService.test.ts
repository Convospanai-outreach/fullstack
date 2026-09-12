import { beforeEach, describe, expect, it, vi, Mock } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        email: { count: vi.fn().mockResolvedValue(0) },
        emailEvent: { count: vi.fn().mockResolvedValue(0) },
        connectedMailbox: { findMany: vi.fn().mockResolvedValue([]) },
        team: { findUnique: vi.fn().mockResolvedValue({ mailingAddress: "123 Main St" }) },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/email-campaigner/service/domainAuthService", () => ({
    checkDomainDeliverabilitySignals: vi.fn(),
}));

import { getDeliverabilityStats } from "./deliverabilityService";
import { checkDomainDeliverabilitySignals } from "@/modules/email-campaigner/service/domainAuthService";

describe("getDeliverabilityStats", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.team.findUnique.mockResolvedValue({ mailingAddress: "123 Main St" });
        (checkDomainDeliverabilitySignals as Mock).mockResolvedValue({
            domain: "example.com",
            mx: true,
            spf: true,
            dkim: true,
            dmarc: true,
        });
    });

    it("scopes every count query to the given team", async () => {
        await getDeliverabilityStats("team-1");

        for (const call of mockPrisma.email.count.mock.calls) {
            expect(call[0].where.campaign.teamId).toBe("team-1");
        }
        expect(mockPrisma.emailEvent.count).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ teamId: "team-1", type: "COMPLAINED" }) })
        );
        expect(mockPrisma.connectedMailbox.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teamId: "team-1", status: "CONNECTED" } })
        );
    });

    it("returns a perfect score with no sends, no complaints, and fully authenticated domains", async () => {
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([{ email: "hello@example.com" }]);

        const stats = await getDeliverabilityStats("team-1");

        expect(stats.score).toBe(100);
        expect(stats.oneClickUnsubscribeActive).toBe(true);
        expect(stats.mailingAddressConfigured).toBe(true);
        expect(stats.domains).toEqual([{ domain: "example.com", mx: true, spf: true, dkim: true, dmarc: true }]);
    });

    it("penalizes a high bounce rate and missing domain authentication", async () => {
        mockPrisma.email.count.mockImplementation(async (args: any) => {
            if (args.where.bouncedAt) return 10; // 10/100 = 10% bounce rate -> severe
            return 100; // sentCount
        });
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([{ email: "hello@example.com" }]);
        (checkDomainDeliverabilitySignals as Mock).mockResolvedValue({
            domain: "example.com",
            mx: true,
            spf: false,
            dkim: false,
            dmarc: false,
        });

        const stats = await getDeliverabilityStats("team-1");

        expect(stats.bounceRate).toBeCloseTo(0.1);
        // 100 - 30 (severe bounce) - 10*3 (spf/dkim/dmarc missing) = 40
        expect(stats.score).toBe(40);
    });

    it("floors the score at 0 rather than going negative", async () => {
        mockPrisma.email.count.mockResolvedValue(100);
        mockPrisma.emailEvent.count.mockResolvedValue(5); // 5% complaint rate -> severe
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([
            { email: "a@one.com" },
            { email: "b@two.com" },
            { email: "c@three.com" },
        ]);
        (checkDomainDeliverabilitySignals as Mock).mockResolvedValue({
            domain: "x.com",
            mx: false,
            spf: false,
            dkim: false,
            dmarc: false,
        });
        mockPrisma.team.findUnique.mockResolvedValue({ mailingAddress: null });

        const stats = await getDeliverabilityStats("team-1");

        expect(stats.score).toBe(0);
    });

    it("falls back to an unauthenticated result when a domain lookup throws", async () => {
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([{ email: "hello@broken-dns.test" }]);
        (checkDomainDeliverabilitySignals as Mock).mockRejectedValue(new Error("DNS lookup failed"));

        const stats = await getDeliverabilityStats("team-1");

        expect(stats.domains).toEqual([{ domain: "broken-dns.test", mx: false, spf: false, dkim: false, dmarc: false }]);
    });
});
