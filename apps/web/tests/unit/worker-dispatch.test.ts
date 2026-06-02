import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch } from "../../src/workers/index";

const { failMock, completeMock } = vi.hoisted(() => ({
  failMock: vi.fn(),
  completeMock: vi.fn(),
}));

vi.mock("@/lib/queue", () => ({
  JobQueue: {
    fail: failMock,
    complete: completeMock,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/workers/handlers/enrichment-worker", () => ({
  handleLeadEnrichment: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/workers/handlers/email-sending-worker", () => ({
  handleEmailSending: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/workers/handlers/campaign-execution-worker", () => ({
  handleCampaignExecution: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/workers/handlers/sequence-step-worker", () => ({
  handleSequenceStep: vi.fn().mockResolvedValue({ ok: true }),
}));

function job(type: string) {
  return {
    id: `job-${type}`,
    type,
    payload: {},
  } as any;
}

describe("Worker dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dead-letters acknowledged job types without throwing", async () => {
    await expect(dispatch(job("workflow_step"))).resolves.toBeUndefined();

    expect(failMock).toHaveBeenCalledWith(
      "job-workflow_step",
      "Handler not implemented for job type: workflow_step"
    );
  });

  it("dead-letters completely unknown job types without crashing the worker", async () => {
    await expect(dispatch(job("unknown_type"))).resolves.toBeUndefined();

    expect(failMock).toHaveBeenCalledWith(
      "job-unknown_type",
      "Unknown job type: unknown_type"
    );
  });

  it("dispatches implemented job handlers without dead-lettering", async () => {
    const { handleEmailSending } = await import("@/workers/handlers/email-sending-worker");

    await dispatch(job("email_sending"));

    expect(handleEmailSending).toHaveBeenCalledWith({});
    expect(failMock).not.toHaveBeenCalled();
  });
});
