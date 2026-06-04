import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch } from "../../src/workers/index";

const { failMock, completeMock, handlers } = vi.hoisted(() => ({
  failMock: vi.fn(),
  completeMock: vi.fn(),
  handlers: {
    enrichment: vi.fn().mockResolvedValue({ ok: true }),
    email: vi.fn().mockResolvedValue({ ok: true }),
    campaign: vi.fn().mockResolvedValue({ ok: true }),
    sequence: vi.fn().mockResolvedValue({ ok: true }),
  },
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
  handleLeadEnrichment: handlers.enrichment,
}));

vi.mock("@/workers/handlers/email-sending-worker", () => ({
  handleEmailSending: handlers.email,
}));

vi.mock("@/workers/handlers/campaign-execution-worker", () => ({
  handleCampaignExecution: handlers.campaign,
}));

vi.mock("@/workers/handlers/sequence-step-worker", () => ({
  handleSequenceStep: handlers.sequence,
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

  it.each([
    "workflow_step",
    "WEBHOOK_DISPATCH",
    "event_processing",
    "linkedin_scraping",
    "CSV_IMPORT",
    "SEQUENCE_ACTION",
  ])("dead-letters acknowledged job type %s without throwing", async (type) => {
    await expect(dispatch(job(type))).resolves.toBeUndefined();

    expect(failMock).toHaveBeenCalledWith(
      `job-${type}`,
      `Handler not implemented for job type: ${type}`
    );
  });

  it("dead-letters completely unknown job types without crashing the worker", async () => {
    await expect(dispatch(job("unknown_type"))).resolves.toBeUndefined();

    expect(failMock).toHaveBeenCalledWith(
      "job-unknown_type",
      "Unknown job type: unknown_type"
    );
  });

  it.each([
    ["lead_enrichment", handlers.enrichment],
    ["email_sending", handlers.email],
    ["campaign_execution", handlers.campaign],
    ["sequence_step", handlers.sequence],
  ])("dispatches implemented job handler %s without dead-lettering", async (type, handler) => {
    await dispatch(job(type));

    expect(handler).toHaveBeenCalledWith({});
    expect(failMock).not.toHaveBeenCalled();
  });
});
