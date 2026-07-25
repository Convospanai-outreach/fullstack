import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/integrations/google/pubsub/route";

describe("Google PubSub FBL Handler (/api/integrations/google/pubsub)", () => {
  it("handles missing message payload gracefully", async () => {
    const req = new Request("http://localhost/api/integrations/google/pubsub", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.note).toBe("No message data payload");
  });

  it("handles invalid json base64 data gracefully", async () => {
    const rawData = Buffer.from("plain-text-not-json").toString("base64");
    const req = new Request("http://localhost/api/integrations/google/pubsub", {
      method: "POST",
      body: JSON.stringify({ message: { data: rawData } }),
    });
    const res = await POST(req as any);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.note).toBe("Raw text payload");
  });
});
