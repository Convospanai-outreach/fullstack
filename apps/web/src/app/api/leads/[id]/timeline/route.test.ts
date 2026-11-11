import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
  mockGetCurrentContext: vi.fn(),
  mockPrisma: {
    lead: { findFirst: vi.fn() },
    emailEvent: { findMany: vi.fn() },
    email: { findMany: vi.fn(), findFirst: vi.fn() },
    message: { findFirst: vi.fn() },
    whatsAppMessage: { findFirst: vi.fn() },
    leadActivity: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

const created = new Date("2026-11-01T10:00:00Z");
const minutesAfter = (m: number) => new Date(created.getTime() + m * 60_000);

describe("GET /api/leads/[id]/timeline first response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentContext.mockResolvedValue({ teamId: "team-1" });
    mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", createdAt: created });
    mockPrisma.emailEvent.findMany.mockResolvedValue([]);
    mockPrisma.email.findMany.mockResolvedValue([]);
    mockPrisma.leadActivity.findMany.mockResolvedValue([]);
    mockPrisma.email.findFirst.mockResolvedValue(null);
    mockPrisma.message.findFirst.mockResolvedValue(null);
    mockPrisma.whatsAppMessage.findFirst.mockResolvedValue(null);
  });

  it("returns seconds from creation to the first outbound email, DM or WhatsApp message", async () => {
    mockPrisma.email.findFirst.mockResolvedValue({ createdAt: minutesAfter(7) });
    mockPrisma.whatsAppMessage.findFirst.mockResolvedValue({ createdAt: minutesAfter(3) });

    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "lead-1" }) });
    const body = await res.json();

    expect(body.firstResponseSeconds).toBe(180);
    expect(mockPrisma.whatsAppMessage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ leadId: "lead-1", direction: "OUTBOUND" }) })
    );
    expect(mockPrisma.message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ leadId: "lead-1", direction: "OUTBOUND" }) })
    );
  });

  it("returns null when nothing outbound has happened yet", async () => {
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "lead-1" }) });
    expect((await res.json()).firstResponseSeconds).toBeNull();
  });
});
