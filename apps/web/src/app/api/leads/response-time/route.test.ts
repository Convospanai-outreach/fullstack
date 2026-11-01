import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
  mockGetCurrentContext: vi.fn(),
  mockPrisma: { lead: { findMany: vi.fn() } },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

const created = new Date("2026-11-01T10:00:00Z");
const after = (m: number) => new Date(created.getTime() + m * 60_000);

describe("GET /api/leads/response-time", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentContext.mockResolvedValue({ teamId: "team-1" });
  });

  it("returns the team median of first response times over landing leads, scoped to the team", async () => {
    mockPrisma.lead.findMany.mockResolvedValue([
      { createdAt: created, emails: [{ createdAt: after(2) }], messages: [], whatsappMessages: [] },
      { createdAt: created, emails: [], messages: [{ createdAt: after(10) }], whatsappMessages: [{ createdAt: after(4) }] },
      { createdAt: created, emails: [], messages: [], whatsappMessages: [] },
    ]);

    const body = await (await GET()).json();

    expect(body).toEqual({ medianSeconds: 180, sampleSize: 2 });
    expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ teamId: "team-1", source: "landing_page" }) })
    );
  });

  it("returns a null median when no lead has been answered", async () => {
    mockPrisma.lead.findMany.mockResolvedValue([{ createdAt: created, emails: [], messages: [], whatsappMessages: [] }]);
    expect(await (await GET()).json()).toEqual({ medianSeconds: null, sampleSize: 0 });
  });

  it("refuses requests without a team", async () => {
    mockGetCurrentContext.mockResolvedValue({ teamId: null });
    expect((await GET()).status).toBe(401);
  });
});
