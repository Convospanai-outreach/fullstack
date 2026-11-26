import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { POST, GET } from "@/app/api/email/unsubscribe/[trackingId]/route";

const upstream = vi.fn();
beforeEach(() => {
  upstream.mockReset().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", upstream);
  vi.stubEnv("API_INTERNAL_ORIGIN", "https://api.example.test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("RFC 8058 One-Click Unsubscribe Endpoint Compliance & Antivirus Pre-fetch Mitigation", () => {
  it("GET /api/email/unsubscribe/[trackingId] returns read-only HTML confirmation page without state mutation (prevents prefetch unsubscribes)", async () => {
    const req = new Request("http://localhost/api/email/unsubscribe/test-tracking-id-123", {
      method: "GET",
    });

    const res = await GET(req as any, { params: Promise.resolve({ trackingId: "test-tracking-id-123" }) } as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const bodyText = await res.text();
    expect(bodyText).toContain("<title>Unsubscribe Confirmation — CraftMyFunnel</title>");
    expect(bodyText).toContain('<form method="POST"');
    expect(upstream).not.toHaveBeenCalled();
  });

  it("POST /api/email/unsubscribe/[trackingId] responds with 200 OK plain terminal response (no redirect)", async () => {
    const req = new Request("http://localhost/api/email/unsubscribe/test-tracking-id-123", {
      method: "POST",
      headers: { "List-Unsubscribe": "One-Click" },
    });

    const res = await POST(req as any, { params: Promise.resolve({ trackingId: "test-tracking-id-123" }) } as any);
    expect(res.status).toBe(200);
    const bodyText = await res.text();
    expect(bodyText).toBe("Unsubscribe request recorded.");
    expect(upstream).toHaveBeenCalledWith(new URL("https://api.example.test/email/unsubscribe/test-tracking-id-123"), expect.objectContaining({
      method: "POST",
      redirect: "error",
    }));
    expect(upstream.mock.calls[0]?.[1]).not.toHaveProperty("headers");
  });

  it("handles duplicate POST requests idempotently without error", async () => {
    const req1 = new Request("http://localhost/api/email/unsubscribe/dup-token-123", {
      method: "POST",
      headers: { "List-Unsubscribe": "One-Click" },
    });
    const req2 = new Request("http://localhost/api/email/unsubscribe/dup-token-123", {
      method: "POST",
      headers: { "List-Unsubscribe": "One-Click" },
    });

    const res1 = await POST(req1 as any, { params: Promise.resolve({ trackingId: "dup-token-123" }) } as any);
    const res2 = await POST(req2 as any, { params: Promise.resolve({ trackingId: "dup-token-123" }) } as any);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("returns a retryable response when the API did not record the unsubscribe", async () => {
    upstream.mockResolvedValueOnce(new Response(null, { status: 503 }));
    const response = await POST(new Request("https://app.example.test", { method: "POST" }) as any, {
      params: Promise.resolve({ trackingId: "retry-example" }),
    });
    expect(response.status).toBe(503);
  });
});
