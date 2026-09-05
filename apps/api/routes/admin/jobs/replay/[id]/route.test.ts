import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";

const { mockCheckAdmin, mockPrisma } = vi.hoisted(() => ({
    mockCheckAdmin: vi.fn(),
    mockPrisma: {
        job: { findUnique: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/lib/admin", () => ({ checkAdmin: mockCheckAdmin }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { POST } from "./route";

function postRequest() {
    return {} as any;
}

function params(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("POST /admin/jobs/replay/[id] - platform-admin scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("401s an ORG_ADMIN and never replays the job", async () => {
        mockCheckAdmin.mockResolvedValue(false);

        const res = await POST(postRequest(), params("job-1"));

        expect(res.status).toBe(401);
        expect(mockCheckAdmin).toHaveBeenCalledWith(UserRole.SYSTEM_ADMIN);
        expect(mockPrisma.job.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.job.update).not.toHaveBeenCalled();
    });

    it("allows a SYSTEM_ADMIN to replay a dead-lettered job", async () => {
        mockCheckAdmin.mockResolvedValue(true);
        mockPrisma.job.findUnique.mockResolvedValue({ id: "job-1", status: "dead_lettered" });
        mockPrisma.job.update.mockResolvedValue({ id: "job-1", status: "queued" });

        const res = await POST(postRequest(), params("job-1"));

        expect(res.status).toBe(200);
        expect(mockPrisma.job.update).toHaveBeenCalledWith({
            where: { id: "job-1" },
            data: expect.objectContaining({ status: "queued" }),
        });
    });
});
