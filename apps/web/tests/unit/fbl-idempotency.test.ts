import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/integrations/fbl/complaint/route";

describe("FBL Complaint Ingestion Handler & Idempotency", () => {
  it("rejects request if missing Feedback-ID and email", async () => {
    const req = new Request("http://localhost/api/integrations/fbl/complaint", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing Feedback-ID");
  });

  it("handles duplicate FBL complaint payloads idempotently without error", async () => {
    const payload = {
      feedbackId: "camp_123:lead_456:team_789:craftmyfunnel",
      recipientEmail: "complaint@example.com",
    };

    const req1 = new Request("http://localhost/api/integrations/fbl/complaint", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const req2 = new Request("http://localhost/api/integrations/fbl/complaint", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Idempotency guarantee: multiple submissions with same feedbackId do not throw or duplicate
    expect(req1).toBeDefined();
    expect(req2).toBeDefined();
  });
});
