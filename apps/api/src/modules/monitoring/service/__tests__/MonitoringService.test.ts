import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        $queryRaw: vi.fn(),
    },
}));

import { prisma } from "@/lib/db";
import { MonitoringService } from "../MonitoringService";

describe("MonitoringService.checkHealth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("reports healthy when the database responds", async () => {
        (prisma.$queryRaw as any).mockResolvedValue([{ "?column?": 1 }]);

        const health = await new MonitoringService().checkHealth();

        expect(health.status).toBe("healthy");
        expect(health.checks.database.ok).toBe(true);
        expect(typeof health.checks.database.latencyMs).toBe("number");
    });

    it("reports unhealthy and surfaces the error when the database is unreachable", async () => {
        (prisma.$queryRaw as any).mockRejectedValue(new Error("connection refused"));

        const health = await new MonitoringService().checkHealth();

        expect(health.status).toBe("unhealthy");
        expect(health.checks.database.ok).toBe(false);
        expect(health.checks.database.error).toBe("connection refused");
    });
});
