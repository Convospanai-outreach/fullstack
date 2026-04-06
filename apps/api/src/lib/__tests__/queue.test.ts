import { vi, Mock } from "vitest";
import { JobQueue } from "../queue";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
    prisma: {
        job: {
            findMany: vi.fn(),
            updateMany: vi.fn(),
            findUnique: vi.fn()
        }
    }
}));

describe("JobQueue.dequeue", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("skips a candidate that loses the claim race and returns the next eligible job", async () => {
        (prisma.job.findMany as Mock).mockResolvedValue([
            { id: "job-1" },
            { id: "job-2" }
        ]);
        (prisma.job.updateMany as Mock)
            .mockResolvedValueOnce({ count: 0 })
            .mockResolvedValueOnce({ count: 1 });
        (prisma.job.findUnique as Mock).mockResolvedValue({
            id: "job-2",
            status: "running"
        });

        const job = await JobQueue.dequeue();

        expect(job?.id).toBe("job-2");
        expect(prisma.job.updateMany).toHaveBeenCalledTimes(2);
        expect(prisma.job.findUnique).toHaveBeenCalledWith({
            where: { id: "job-2" }
        });
    });

    it("keeps legacy pending jobs claimable through the atomic guard", async () => {
        (prisma.job.findMany as Mock).mockResolvedValue([
            { id: "legacy-job" }
        ]);
        (prisma.job.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
        (prisma.job.findUnique as Mock).mockResolvedValue({
            id: "legacy-job",
            status: "running"
        });

        const job = await JobQueue.dequeue();

        expect(job?.id).toBe("legacy-job");
        expect(prisma.job.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: "legacy-job",
                    status: { in: ["queued", "pending"] }
                })
            })
        );
    });
});
