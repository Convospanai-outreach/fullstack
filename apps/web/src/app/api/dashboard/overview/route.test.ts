import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockContext } = vi.hoisted(() => ({
  mockPrisma: {
    lead: { groupBy: vi.fn() },
    email: { count: vi.fn() },
    emailEvent: { count: vi.fn() },
    leadActivity: { count: vi.fn() },
    whatsAppMessage: { count: vi.fn() },
    approvalRequest: { findMany: vi.fn() },
  },
  mockContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockContext }));

import { GET } from "./route";

describe("GET /api/dashboard/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockContext.mockResolvedValue({ userId: "u1", teamId: "team-1" });
    mockPrisma.lead.groupBy.mockResolvedValue([
      { pipelineState: "COLD", _count: { _all: 7 } },
      { pipelineState: "HOT", _count: { _all: 2 } },
    ]);
    mockPrisma.email.count.mockResolvedValue(12);
    mockPrisma.emailEvent.count.mockResolvedValue(3);
    mockPrisma.leadActivity.count.mockResolvedValue(5);
    mockPrisma.whatsAppMessage.count.mockImplementation(async ({ where }: { where: { direction: string } }) => (where.direction === "OUTBOUND" ? 4 : 1));
    mockPrisma.approvalRequest.findMany.mockResolvedValue([
      {
        id: "a1", actionType: "SEND_EMAIL", status: "APPROVED", reviewedAt: new Date("2026-11-10T10:00:00Z"), updatedAt: new Date("2026-11-11T10:00:00Z"),
        reviewer: { name: "Sid", firstName: "S" }, payload: { body: "secret message text" },
      },
      { id: "a2", actionType: "SEND_EMAIL", status: "REJECTED", reviewedAt: null, updatedAt: new Date("2026-11-09T10:00:00Z"), reviewer: null },
    ]);
  });

  it("returns every pipeline stage with real counts, zero where there are none", async () => {
    const json = await (await GET()).json();
    expect(json.stages.map((s: { stage: string }) => s.stage)).toEqual(["COLD", "WARM", "HOT", "COORDINATING", "MEETING_CONFIRMED", "COMPLETED"]);
    expect(json.stages.find((s: { stage: string }) => s.stage === "COLD").count).toBe(7);
    expect(json.stages.find((s: { stage: string }) => s.stage === "WARM").count).toBe(0);
  });

  it("reports channel activity, with LinkedIn replies as null because none are recorded", async () => {
    const json = await (await GET()).json();
    expect(json.channels).toEqual([
      { channel: "email", sent: 12, replies: 3 },
      { channel: "linkedin", sent: 5, replies: null },
      { channel: "whatsapp", sent: 4, replies: 1 },
    ]);
  });

  it("scopes every query to the caller's team", async () => {
    await GET();
    expect(mockPrisma.lead.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-1" } }));
    expect(mockPrisma.email.count).toHaveBeenCalledWith({ where: expect.objectContaining({ lead: { teamId: "team-1" } }) });
    expect(mockPrisma.approvalRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ teamId: "team-1" }) }));
  });

  it("lists decisions without the message text, falling back to the update time and no reviewer", async () => {
    const json = await (await GET()).json();
    expect(json.record).toEqual([
      { id: "a1", action: "SEND_EMAIL", status: "APPROVED", at: "2026-11-10T10:00:00.000Z", by: "Sid" },
      { id: "a2", action: "SEND_EMAIL", status: "REJECTED", at: "2026-11-09T10:00:00.000Z", by: null },
    ]);
    expect(JSON.stringify(json)).not.toContain("secret message text");
  });

  it("returns empty sections and queries nothing when there is no team", async () => {
    mockContext.mockResolvedValue({ userId: "u1", teamId: null });
    expect(await (await GET()).json()).toEqual({ stages: [], channels: [], record: [] });
    expect(mockPrisma.lead.groupBy).not.toHaveBeenCalled();
  });

  it("answers 500 when a query fails", async () => {
    mockPrisma.lead.groupBy.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
