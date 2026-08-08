import { vi, Mock } from 'vitest';
import { SequenceService } from "../sequenceService";
import { JobQueue } from "@/lib/queue";

vi.mock("@/lib/queue", () => ({
    JobQueue: {
        enqueue: vi.fn()
    }
}));

describe("SequenceService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (JobQueue.enqueue as Mock).mockResolvedValue({ id: "job_1" });
    });

    it("starts a sequence by scheduling an immediate VISIT step", async () => {
        await SequenceService.startSequence("lead_1", "https://example.com/in/lead");

        expect(JobQueue.enqueue).toHaveBeenCalledTimes(1);
        const [type, payload, options] = (JobQueue.enqueue as Mock).mock.calls[0];
        expect(type).toBe("SEQUENCE_ACTION");
        expect(payload).toEqual({
            leadId: "lead_1",
            url: "https://example.com/in/lead",
            action: "VISIT"
        });
        expect(options.priority).toBe(0);
        expect(options.processAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it("schedules a step with the requested delay", async () => {
        await SequenceService.scheduleStep("lead_2", "https://example.com/in/lead2", "MESSAGE", 120);

        const [, payload, options] = (JobQueue.enqueue as Mock).mock.calls[0];
        expect(payload.action).toBe("MESSAGE");
        const delayMs = options.processAt.getTime() - Date.now();
        expect(delayMs).toBeGreaterThan(100_000);
        expect(delayMs).toBeLessThanOrEqual(120_000);
    });

    it.each([
        ["VISIT", "CONNECT", 3600],
        ["CONNECT", "MESSAGE", 86400],
        ["MESSAGE", "EMAIL", 172800],
    ] as const)("advances %s to %s after %d seconds", async (current, next, delaySeconds) => {
        await SequenceService.scheduleNextStep("lead_3", "https://example.com/in/lead3", current);

        expect(JobQueue.enqueue).toHaveBeenCalledTimes(1);
        const [, payload, options] = (JobQueue.enqueue as Mock).mock.calls[0];
        expect(payload.action).toBe(next);
        const delayMs = options.processAt.getTime() - Date.now();
        expect(delayMs).toBeGreaterThan((delaySeconds - 1) * 1000);
    });

    it("does not schedule another step once EMAIL is reached", async () => {
        await SequenceService.scheduleNextStep("lead_4", "https://example.com/in/lead4", "EMAIL");

        expect(JobQueue.enqueue).not.toHaveBeenCalled();
    });
});
