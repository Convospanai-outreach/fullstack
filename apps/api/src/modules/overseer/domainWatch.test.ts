import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockCheck, mockSend } = vi.hoisted(() => ({
    mockPrisma: {
        connectedMailbox: { findMany: vi.fn() },
        domainAuthenticationCheck: { findUnique: vi.fn(), upsert: vi.fn() },
        overseerNudge: { create: vi.fn(), updateMany: vi.fn() },
        teamMember: { findMany: vi.fn() },
    },
    mockCheck: vi.fn(),
    mockSend: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/modules/email-campaigner/service/domainAuthService", () => ({ checkDomainDeliverabilitySignals: mockCheck }));
vi.mock("@/lib/notifications", () => ({ NotificationDispatcher: { send: mockSend } }));

import { failingRecords, runDomainWatch } from "./domainWatch";

const PASS = { mx: true, spf: true, dkim: true, dmarc: true };
const NOW = new Date("2026-11-02T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

describe("runDomainWatch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([
            { teamId: "team-1", email: "a@send.example" },
            { teamId: "team-1", email: "b@send.example" },
        ]);
        mockPrisma.teamMember.findMany.mockResolvedValue([
            { userId: "u-owner", role: "owner" },
            { userId: "u-admin", role: "admin" },
        ]);
    });

    it("lists failing records in a fixed order", () => {
        expect(failingRecords({ ...PASS, dmarc: false, spf: false })).toEqual(["SPF", "DMARC"]);
    });

    it("checks each domain once and marks a passing domain VERIFIED, closing open alarms", async () => {
        mockCheck.mockResolvedValue(PASS);
        mockPrisma.domainAuthenticationCheck.findUnique.mockResolvedValue({ status: "ALERTED", createdAt: hoursAgo(100) });

        const result = await runDomainWatch(NOW);

        expect(result).toEqual({ domainsChecked: 1, alarms: 0 });
        expect(mockCheck).toHaveBeenCalledTimes(1);
        expect(mockPrisma.domainAuthenticationCheck.upsert.mock.calls[0][0].update.status).toBe("VERIFIED");
        expect(mockPrisma.overseerNudge.updateMany).toHaveBeenCalledWith({
            where: { teamId: "team-1", nudgeType: "DOMAIN_HEALTH", stage: "send.example", status: "OPEN" },
            data: { status: "DISMISSED" },
        });
        expect(mockPrisma.overseerNudge.create).not.toHaveBeenCalled();
    });

    it("raises an alarm and emails only the owner when a verified domain goes down", async () => {
        mockCheck.mockResolvedValue({ ...PASS, spf: false });
        mockPrisma.domainAuthenticationCheck.findUnique.mockResolvedValue({ status: "VERIFIED", createdAt: hoursAgo(500) });

        const result = await runDomainWatch(NOW);

        expect(result.alarms).toBe(1);
        const data = mockPrisma.overseerNudge.create.mock.calls[0][0].data;
        expect(data).toMatchObject({ teamId: "team-1", stage: "send.example", nudgeType: "DOMAIN_HEALTH", stallDays: 0 });
        expect(data.suggestion).toContain("stopped passing");
        expect(data.suggestion).toContain("SPF");
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend.mock.calls[0][0]).toBe("u-owner");
        expect(mockPrisma.domainAuthenticationCheck.upsert.mock.calls[0][0].update.status).toBe("ALERTED");
    });

    it("stays quiet for a new domain inside the 48 hour wait", async () => {
        mockCheck.mockResolvedValue({ ...PASS, dkim: false });
        mockPrisma.domainAuthenticationCheck.findUnique.mockResolvedValue({ status: "PENDING", createdAt: hoursAgo(20) });

        expect((await runDomainWatch(NOW)).alarms).toBe(0);
        expect(mockPrisma.overseerNudge.create).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it("alarms once when a never-verified domain is still failing after 48 hours", async () => {
        mockCheck.mockResolvedValue({ ...PASS, dkim: false });
        mockPrisma.domainAuthenticationCheck.findUnique.mockResolvedValue({ status: "PENDING", createdAt: hoursAgo(60) });

        expect((await runDomainWatch(NOW)).alarms).toBe(1);
        expect(mockPrisma.overseerNudge.create.mock.calls[0][0].data.suggestion).toContain("after 48 hours");
    });

    it("does not alarm again for a domain already alerted and still failing", async () => {
        mockCheck.mockResolvedValue({ ...PASS, spf: false });
        mockPrisma.domainAuthenticationCheck.findUnique.mockResolvedValue({ status: "ALERTED", createdAt: hoursAgo(500) });

        expect((await runDomainWatch(NOW)).alarms).toBe(0);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it("skips a domain whose lookup could not run and falls back to admins when there is no owner", async () => {
        mockCheck.mockRejectedValue(new Error("dns down"));
        expect(await runDomainWatch(NOW)).toEqual({ domainsChecked: 0, alarms: 0 });

        mockCheck.mockResolvedValue({ ...PASS, mx: false });
        mockPrisma.domainAuthenticationCheck.findUnique.mockResolvedValue({ status: "VERIFIED", createdAt: hoursAgo(500) });
        mockPrisma.teamMember.findMany.mockResolvedValue([{ userId: "u-admin", role: "admin" }]);
        await runDomainWatch(NOW);
        expect(mockSend.mock.calls[0][0]).toBe("u-admin");
    });
});
