import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockSequenceService } = vi.hoisted(() => ({
    mockSequenceService: {
        executeRun: vi.fn().mockResolvedValue({ runId: "run-1", status: "COMPLETED" }),
        processDue: vi.fn().mockResolvedValue({ processed: 0, results: [] }),
    },
}));

vi.mock("@/modules/email-campaigner/service/sequenceService", () => ({
    SequenceService: mockSequenceService,
}));

import { handleSequenceExecution } from "../sequence-worker";

describe("handleSequenceExecution", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("forwards the caller-scoped teamId when executing a specific run", async () => {
        await handleSequenceExecution({ runId: "run-1", teamId: "team-1" });

        expect(mockSequenceService.executeRun).toHaveBeenCalledWith({ runId: "run-1", teamId: "team-1" });
    });

    it("falls back to processDue, scoped by teamId, when no runId is given", async () => {
        await handleSequenceExecution({ teamId: "team-1", limit: 10 });

        expect(mockSequenceService.executeRun).not.toHaveBeenCalled();
        expect(mockSequenceService.processDue).toHaveBeenCalledWith({ teamId: "team-1", limit: 10 });
    });
});
