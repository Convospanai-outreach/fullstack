import { beforeEach, describe, expect, it, vi, Mock } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        email: { count: vi.fn().mockResolvedValue(0) },
        emailEvent: { count: vi.fn().mockResolvedValue(0) },
        connectedMailbox: { findMany: vi.fn().mockResolvedValue([]) },
        team: { findUnique: vi.fn().mockResolvedValue({ mailingAddress: "123 Main St" }) },
        domainAuthenticationCheck: {
            upsert: vi.fn().mockResolvedValue({}),
            findMany: vi.fn().mockResolvedValue([]),
        },
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
        mockPrisma.domainAuthenticationCheck.upsert.mockResolvedValue({});
        mockPrisma.domainAuthenticationCheck.findMany.mockResolvedValue([]);
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

    it("returns a perfect team score and a healthy active domain entry with no sends, no complaints, and full authentication", async () => {
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([{ email: "hello@example.com" }]);

        const stats = await getDeliverabilityStats("team-1");

        expect(stats.score).toBe(100);
        expect(stats.oneClickUnsubscribeActive).toBe(true);
        expect(stats.mailingAddressConfigured).toBe(true);
        expect(stats.domains).toEqual([
            expect.objectContaining({
                domain: "example.com",
                mx: true,
                spf: true,
                dkim: true,
                dmarc: true,
                active: true,
                score: 100,
                label: "Healthy",
            }),
        ]);
    });

    it("penalizes a high bounce rate and missing domain authentication at both the team and domain level", async () => {
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
        // Team score: 100 - 30 (severe bounce) - 10*3 (spf/dkim/dmarc missing) = 40
        expect(stats.score).toBe(40);
        // Domain score: 100 - 25(spf) - 25(dkim) - 20(dmarc) - 10(active, severe bounce) = 20 -> Poor
        expect(stats.domains[0]).toEqual(expect.objectContaining({ score: 20, label: "Poor" }));
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

        expect(stats.domains).toEqual([
            expect.objectContaining({ domain: "broken-dns.test", mx: false, spf: false, dkim: false, dmarc: false, active: true }),
        ]);
    });

    it("persists a GENERIC domain-auth check with lastActiveAt for every active domain", async () => {
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([{ email: "hello@example.com" }]);

        await getDeliverabilityStats("team-1");

        expect(mockPrisma.domainAuthenticationCheck.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teamId_domain_provider: { teamId: "team-1", domain: "example.com", provider: "GENERIC" } },
                create: expect.objectContaining({ lastActiveAt: expect.any(Date) }),
                update: expect.objectContaining({ lastActiveAt: expect.any(Date) }),
            })
        );
    });

    it("still surfaces a domain that no longer matches any connected mailbox, marked inactive", async () => {
        // No mailboxes connected anymore for this domain...
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([]);
        // ...but it was checked (and actively used) before, per DomainAuthenticationCheck history.
        const lastActiveAt = new Date("2026-08-01T00:00:00.000Z");
        mockPrisma.domainAuthenticationCheck.findMany.mockResolvedValue([
            { domain: "retired-example.com", lastActiveAt, updatedAt: lastActiveAt },
        ]);
        (checkDomainDeliverabilitySignals as Mock).mockResolvedValue({
            domain: "retired-example.com",
            mx: false,
            spf: false,
            dkim: false,
            dmarc: false,
        });

        const stats = await getDeliverabilityStats("team-1");

        expect(stats.domains).toEqual([
            expect.objectContaining({
                domain: "retired-example.com",
                active: false,
                lastActiveAt: lastActiveAt.toISOString(),
            }),
        ]);
        // A retired domain's persisted upsert must not overwrite lastActiveAt (it's no
        // longer actively sending), only refresh its DNS status.
        expect(mockPrisma.domainAuthenticationCheck.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { teamId_domain_provider: { teamId: "team-1", domain: "retired-example.com", provider: "GENERIC" } },
                create: expect.not.objectContaining({ lastActiveAt: expect.anything() }),
                update: expect.not.objectContaining({ lastActiveAt: expect.anything() }),
            })
        );
    });

    it("scores a retired domain without applying the team's current bounce/complaint rate to it", async () => {
        mockPrisma.email.count.mockImplementation(async (args: any) => {
            if (args.where.bouncedAt) return 10;
            return 100;
        });
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([]);
        mockPrisma.domainAuthenticationCheck.findMany.mockResolvedValue([
            { domain: "retired-example.com", lastActiveAt: null, updatedAt: new Date() },
        ]);
        (checkDomainDeliverabilitySignals as Mock).mockResolvedValue({
            domain: "retired-example.com",
            mx: true,
            spf: true,
            dkim: true,
            dmarc: true,
        });

        const stats = await getDeliverabilityStats("team-1");

        // Fully authenticated, and no engagement penalty applied since it's inactive.
        expect(stats.domains[0]).toEqual(expect.objectContaining({ score: 100, label: "Healthy", active: false }));
    });
});
