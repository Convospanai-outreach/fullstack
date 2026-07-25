import { describe, it, expect, vi } from "vitest";
import { POST, GET } from "@/app/api/email/unsubscribe/[trackingId]/route";

describe("RFC 8058 One-Click Unsubscribe Endpoint Compliance", () => {
  it("POST /api/email/unsubscribe/[trackingId] responds with 200 OK plain terminal response (no redirect)", async () => {
    const req = new Request("http://localhost/api/email/unsubscribe/test-tracking-id-123", {
      method: "POST",
      headers: { "List-Unsubscribe": "One-Click" },
    });

    const res = await POST(req as any, { params: { trackingId: "test-tracking-id-123" } });
    expect(res.status).toBe(200);
    const bodyText = await res.text();
    expect(bodyText).toBe("Unsubscribe request recorded.");
  });

  it("GET /api/email/unsubscribe/[trackingId] responds with 200 OK plain terminal response", async () => {
    const req = new Request("http://localhost/api/email/unsubscribe/test-tracking-id-123", {
      method: "GET",
    });

    const res = await GET(req as any, { params: { trackingId: "test-tracking-id-123" } });
    expect(res.status).toBe(200);
    const bodyText = await res.text();
    expect(bodyText).toBe("Unsubscribe request recorded.");
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

    const res1 = await POST(req1 as any, { params: { trackingId: "dup-token-123" } });
    const res2 = await POST(req2 as any, { params: { trackingId: "dup-token-123" } });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
