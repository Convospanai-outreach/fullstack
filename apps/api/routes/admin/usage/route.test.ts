import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

const { mockCheckAdmin, mockPrisma } = vi.hoisted(() => ({
    mockCheckAdmin: vi.fn(),
    mockPrisma: {
        user: { findMany: vi.fn() },
        creditLedger: { findMany: vi.fn() },
        creditTransaction: { groupBy: vi.fn() },
        lLMUsageLog: { groupBy: vi.fn() },
    },
}));

vi.mock("@/lib/admin", () => ({ checkAdmin: mockCheckAdmin }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

function getRequest() {
    return new Request("http://localhost/api/admin/usage?range=30d");
}

describe("GET /admin/usage - platform-admin scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("403s an ORG_ADMIN and never queries user/credit/usage data", async () => {
        mockCheckAdmin.mockResolvedValue(false);

        const res = await GET(getRequest());

        expect(res.status).toBe(403);
        expect(mockCheckAdmin).toHaveBeenCalledWith(UserRole.SYSTEM_ADMIN);
        expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
        expect(mockPrisma.creditLedger.findMany).not.toHaveBeenCalled();
        expect(mockPrisma.creditTransaction.groupBy).not.toHaveBeenCalled();
        expect(mockPrisma.lLMUsageLog.groupBy).not.toHaveBeenCalled();
    });

    it("allows a SYSTEM_ADMIN to fetch platform-wide usage", async () => {
        mockCheckAdmin.mockResolvedValue(true);
        mockPrisma.user.findMany.mockResolvedValue([]);
        mockPrisma.creditLedger.findMany.mockResolvedValue([]);
        mockPrisma.creditTransaction.groupBy.mockResolvedValue([]);
        mockPrisma.lLMUsageLog.groupBy.mockResolvedValue([]);

        const res = await GET(getRequest());

        expect(res.status).toBe(200);
        expect(mockPrisma.user.findMany).toHaveBeenCalled();
    });
});
