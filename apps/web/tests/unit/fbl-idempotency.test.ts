import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const FBL_SECRET = "test-fbl-secret";

const { mockLead, mockSuppressionEntry } = vi.hoisted(() => ({
  mockLead: { findUnique: vi.fn(), updateMany: vi.fn() },
  mockSuppressionEntry: { upsert: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: { lead: mockLead, suppressionEntry: mockSuppressionEntry },
}));

import { POST } from "@/app/api/integrations/fbl/complaint/route";

function signedRequest(body: any, { badSecret = false, headers = true }: { badSecret?: boolean; headers?: boolean } = {}) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  const expectedSecret = crypto.createHmac("sha256", FBL_SECRET).update(`${rawBody}.${timestamp}`).digest("hex");
  const secret = badSecret ? "0".repeat(64) : expectedSecret;

  return new Request("http://localhost/api/integrations/fbl/complaint", {
    method: "POST",
    headers: headers ? { "X-FBL-Secret": secret, "X-FBL-Timestamp": timestamp } : {},
    body: rawBody,
  }) as any;
}

describe("FBL Complaint Ingestion Handler & Idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["FBL_WEBHOOK_SECRET"] = FBL_SECRET;
    mockLead.findUnique.mockResolvedValue(null);
    mockLead.updateMany.mockResolvedValue({ count: 0 });
    mockSuppressionEntry.upsert.mockResolvedValue({});
  });

  it("rejects a request with no signature headers before touching the database", async () => {
    const req = signedRequest({}, { headers: false });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockLead.findUnique).not.toHaveBeenCalled();
    expect(mockSuppressionEntry.upsert).not.toHaveBeenCalled();
  });

  it("rejects a request with an invalid signature", async () => {
    const req = signedRequest({ feedbackId: "camp_123:lead_456:team_789:craftmyfunnel" }, { badSecret: true });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockSuppressionEntry.upsert).not.toHaveBeenCalled();
  });

  it("returns 503 when FBL_WEBHOOK_SECRET is not configured, never falling back to unauthenticated", async () => {
    delete process.env["FBL_WEBHOOK_SECRET"];
    const req = signedRequest({ recipientEmail: "x@example.com" });
    const res = await POST(req);
    expect(res.status).toBe(503);
    expect(mockSuppressionEntry.upsert).not.toHaveBeenCalled();
  });

  it("rejects a correctly-signed request missing Feedback-ID and email", async () => {
    const req = signedRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing Feedback-ID");
  });

  it("processes a correctly-signed complaint, suppresses the lead, and never echoes email/teamId back", async () => {
    const req = signedRequest({
      feedbackId: "camp_123:lead_456:team_789:craftmyfunnel",
      recipientEmail: "complaint@example.com",
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: true, processed: true });
    expect(mockSuppressionEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId_email: { teamId: "team_789", email: "complaint@example.com" } },
      })
    );
    expect(mockLead.updateMany).toHaveBeenCalledWith({
      where: { teamId: "team_789", email: "complaint@example.com" },
      data: { status: "OPT_OUT" },
    });
  });
});
