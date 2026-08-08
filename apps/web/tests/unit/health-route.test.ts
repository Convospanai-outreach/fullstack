import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/health/route";

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
    vi.clearAllMocks();
    queryRawMock.mockResolvedValue([{ ok: 1 }]);
  });

  it("returns a fast liveness response without touching the database", async () => {
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

    const response = await GET(request("/api/health?probe=ready"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "unhealthy",
      probe: "readiness",
      checks: { database: "down" },
    });
  });

  it("defaults to readiness in production when no probe param is supplied", async () => {
    const originalEnv = process.env["NODE_ENV"];
    (process.env as Record<string, string | undefined>)["NODE_ENV"] = "production";
    try {
      const response = await GET(request("/api/health"));
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.probe).toBe("readiness");
    } finally {
      (process.env as Record<string, string | undefined>)["NODE_ENV"] = originalEnv;
    }
  });

  it("handles OPTIONS request with CORS headers", async () => {
    const { OPTIONS } = await import("../../src/app/api/health/route");
    const response = await OPTIONS();
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
