import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROCESSED_LEAD_STATUSES } from "./campaignLeadStatus";

const read = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");

describe("PROCESSED_LEAD_STATUSES", () => {
  it("includes the statuses the draft generator and the sender actually write", () => {
    expect(read("workers/handlers/campaign-execution-worker.ts")).toContain('status: "DRAFT_READY"');
    expect(read("workers/handlers/email-sending-worker.ts")).toContain('status: "OUTREACH_SENT"');
    expect(PROCESSED_LEAD_STATUSES).toEqual(expect.arrayContaining(["DRAFT_READY", "OUTREACH_SENT", "REPLIED"]));
  });

  it("is the list both campaign progress counts use", () => {
    expect(read("workers/handlers/campaign-execution-worker.ts")).toContain("status: { in: PROCESSED_LEAD_STATUSES }");
    expect(read("app/(dashboard)/campaigns/page.tsx")).toContain("status: { in: PROCESSED_LEAD_STATUSES }");
  });
});
