import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/metrics/route";

vi.mock("@/lib/metrics", () => ({
  getMetrics: vi.fn().mockResolvedValue("# HELP test_metric\n# TYPE test_metric counter\n"),
}));

function request(headers?: HeadersInit) {
  return new Request("http://localhost:3000/api/metrics", headers ? { headers } : undefined);
}

describe("/api/metrics", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: "production", METRICS_TOKEN: "test-token" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rejects requests without the metrics bearer token", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
  });

  it("returns prometheus metrics to authorized scrapers", async () => {
    const response = await GET(request({ Authorization: "Bearer test-token" }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain("# HELP");
  });

  it("allows access when METRICS_TOKEN is not set in non-production", async () => {
    delete (process.env as Record<string, string | undefined>)["METRICS_TOKEN"];
    (process.env as Record<string, string | undefined>)["NODE_ENV"] = "development";
    const response = await GET(request());
    expect(response.status).toBe(200);
  });

  it("returns 500 when getMetrics throws an error", async () => {
    const { getMetrics } = await import("@/lib/metrics");
    vi.mocked(getMetrics).mockRejectedValueOnce(new Error("metrics failure"));
    const response = await GET(request({ Authorization: "Bearer test-token" }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Failed to collect metrics");
  });
});
