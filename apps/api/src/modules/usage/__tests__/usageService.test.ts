import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        userQuota: {
            findMany: vi.fn(),
        },
        organizationPolicy: {
            findUnique: vi.fn(),
        },
        teamMember: {
            count: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
import { UsageService } from "../usageService";

describe("UsageService.getUsageStats", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sums UserQuota rows across the team when quotas exist", async () => {
        (prisma.userQuota.findMany as any).mockResolvedValue([
            { currentSpend: 30, monthlyLimit: 50 },
            { currentSpend: 20, monthlyLimit: 50 },
        ]);

        const usage = await UsageService.getUsageStats("team-1");

        expect(prisma.userQuota.findMany).toHaveBeenCalledWith({ where: { teamId: "team-1" } });
        expect(usage).toEqual({ teamId: "team-1", currentSpend: 50, monthlyLimit: 100, credits: 50 });
    });

    it("clamps credits at 0 when spend exceeds the limit", async () => {
        (prisma.userQuota.findMany as any).mockResolvedValue([{ currentSpend: 80, monthlyLimit: 50 }]);

        const usage = await UsageService.getUsageStats("team-1");

        expect(usage.credits).toBe(0);
    });

    it("falls back to the org policy's per-user default when no quota rows exist", async () => {
        (prisma.userQuota.findMany as any).mockResolvedValue([]);
        (prisma.organizationPolicy.findUnique as any).mockResolvedValue({ maxCreditsPerUser: 75 });
        (prisma.teamMember.count as any).mockResolvedValue(3);

        const usage = await UsageService.getUsageStats("team-1");

        expect(usage).toEqual({ teamId: "team-1", currentSpend: 0, monthlyLimit: 225, credits: 225 });
    });

    it("falls back to a 50-credit default when there is no policy either", async () => {
        (prisma.userQuota.findMany as any).mockResolvedValue([]);
        (prisma.organizationPolicy.findUnique as any).mockResolvedValue(null);
        (prisma.teamMember.count as any).mockResolvedValue(0);

        const usage = await UsageService.getUsageStats("team-1");

        expect(usage.monthlyLimit).toBe(50);
    });
});
