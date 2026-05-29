import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

function request(path: string) {
  return new Request(`http://localhost:3000${path}`);
}

describe("/api/health", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    queryRawMock.mockResolvedValue([{ ok: 1 }]);
  });

  it("returns a fast liveness response without touching the database", async () => {
    const { GET } = await import("../../src/app/api/health/route");

    const response = await GET(request("/api/health?probe=live"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "alive",
      probe: "liveness",
      service: "craftmyfunnel-web",
    });
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("returns healthy readiness when the database probe succeeds", async () => {
    const { GET } = await import("../../src/app/api/health/route");

    const response = await GET(request("/api/health?probe=ready"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "healthy",
      probe: "readiness",
      checks: { database: "up" },
    });
    expect(queryRawMock).toHaveBeenCalledOnce();
  });

  it("returns 503 readiness when the database probe fails", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("database unavailable"));
    const { GET } = await import("../../src/app/api/health/route");

    const response = await GET(request("/api/health?probe=ready"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "unhealthy",
      probe: "readiness",
      checks: { database: "down" },
    });
  });
});
