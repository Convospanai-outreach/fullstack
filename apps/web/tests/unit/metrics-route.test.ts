import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/metrics", () => ({
  getMetrics: vi.fn().mockResolvedValue("# HELP test_metric\n# TYPE test_metric counter\n"),
}));

function request(headers?: HeadersInit) {
  return new Request("http://localhost:3000/api/metrics", headers ? { headers } : undefined);
}

describe("/api/metrics", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, NODE_ENV: "production", METRICS_TOKEN: "test-token" };
  });

  it("rejects requests without the metrics bearer token", async () => {
    const { GET } = await import("../../src/app/api/metrics/route");

    const response = await GET(request());

    expect(response.status).toBe(401);
  });

  it("returns prometheus metrics to authorized scrapers", async () => {
    const { GET } = await import("../../src/app/api/metrics/route");

    const response = await GET(request({ Authorization: "Bearer test-token" }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain("# HELP");
  });
});
