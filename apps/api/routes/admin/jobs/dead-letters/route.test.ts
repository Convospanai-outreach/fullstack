import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

const { mockCheckAdmin, mockPrisma } = vi.hoisted(() => ({
    mockCheckAdmin: vi.fn(),
    mockPrisma: {
        job: { findMany: vi.fn(), count: vi.fn() },
    },
}));

vi.mock("@/lib/admin", () => ({ checkAdmin: mockCheckAdmin }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

function getRequest() {
    return { nextUrl: new URL("http://localhost/api/admin/jobs/dead-letters") } as any;
}

describe("GET /admin/jobs/dead-letters - platform-admin scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("401s an ORG_ADMIN and never lists jobs", async () => {
        mockCheckAdmin.mockResolvedValue(false);

        const res = await GET(getRequest());

        expect(res.status).toBe(401);
        expect(mockCheckAdmin).toHaveBeenCalledWith(UserRole.SYSTEM_ADMIN);
        expect(mockPrisma.job.findMany).not.toHaveBeenCalled();
    });

    it("allows a SYSTEM_ADMIN to list dead-lettered jobs", async () => {
        mockCheckAdmin.mockResolvedValue(true);
        mockPrisma.job.findMany.mockResolvedValue([{ id: "job-1" }]);
        mockPrisma.job.count.mockResolvedValue(1);

        const res = await GET(getRequest());

        expect(res.status).toBe(200);
        expect(mockPrisma.job.findMany).toHaveBeenCalled();
    });
});
